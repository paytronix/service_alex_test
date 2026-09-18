import {
  EmployeeStatus,
  InvoiceStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";
import {
  DEFAULT_CURRENCY,
  isWithinPlanLimit,
  PlanFeature,
  planAllowsFeature,
  planLimits,
  type PlanLimits,
  type SubscriptionEventPayload,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";
import { stripeClient, StripeClient, type StripeEvent } from "./stripe-client";

const auditService = new AuditService();

const PLAN_BY_PRICE_ENV: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.FREE]: "",
  [SubscriptionPlan.PRO]: "STRIPE_PRICE_PRO",
  [SubscriptionPlan.BUSINESS]: "STRIPE_PRICE_BUSINESS",
};

function statusFromStripe(status: string): SubscriptionStatus {
  if (status === "active" || status === "trialing") return SubscriptionStatus.ACTIVE;
  if (status === "past_due" || status === "unpaid" || status === "incomplete") {
    return SubscriptionStatus.PAST_DUE;
  }
  return SubscriptionStatus.CANCELLED;
}

function invoiceStatusFromStripe(status: string | undefined): InvoiceStatus {
  switch (status) {
    case "paid":
      return InvoiceStatus.PAID;
    case "open":
      return InvoiceStatus.OPEN;
    case "void":
      return InvoiceStatus.VOID;
    case "uncollectible":
      return InvoiceStatus.UNCOLLECTIBLE;
    default:
      return InvoiceStatus.DRAFT;
  }
}

/** Subscriptions, invoices and plan-limit enforcement. */
export class BillingService {
  constructor(private readonly stripe: StripeClient = stripeClient) {}

  /** The stored subscription, defaulting to FREE for organizations without one. */
  async subscription(organizationId: string) {
    const existing = await prisma.subscription.findUnique({ where: { organizationId } });
    if (existing) return existing;
    return prisma.subscription.create({
      data: {
        organizationId,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  async limits(organizationId: string): Promise<PlanLimits> {
    const subscription = await this.subscription(organizationId);
    return planLimits(subscription.plan as unknown as import("@shiftflow/shared").SubscriptionPlan);
  }

  async usage(organizationId: string): Promise<{ employeeCount: number; locationCount: number }> {
    const [employeeCount, locationCount] = await Promise.all([
      prisma.employee.count({
        where: { organizationId, status: { not: EmployeeStatus.DISMISSED } },
      }),
      prisma.location.count({ where: { organizationId } }),
    ]);
    return { employeeCount, locationCount };
  }

  async invoices(organizationId: string) {
    return prisma.invoice.findMany({ where: { organizationId }, orderBy: { issuedAt: "desc" } });
  }

  /** Throws when adding another employee would exceed the plan limit. */
  async assertCanAddEmployee(organizationId: string): Promise<void> {
    const [limits, usage] = await Promise.all([
      this.limits(organizationId),
      this.usage(organizationId),
    ]);
    if (!isWithinPlanLimit(limits.maxEmployees, usage.employeeCount)) {
      throw new Error(
        `Plan ${limits.plan} allows at most ${limits.maxEmployees} employees. Upgrade to add more.`,
      );
    }
  }

  /** Throws when adding another location would exceed the plan limit. */
  async assertCanAddLocation(organizationId: string): Promise<void> {
    const [limits, usage] = await Promise.all([
      this.limits(organizationId),
      this.usage(organizationId),
    ]);
    if (!isWithinPlanLimit(limits.maxLocations, usage.locationCount)) {
      throw new Error(
        `Plan ${limits.plan} allows at most ${limits.maxLocations} locations. Upgrade to add more.`,
      );
    }
  }

  /** Throws when the organization's plan does not include `feature`. */
  async assertFeature(organizationId: string, feature: PlanFeature): Promise<void> {
    const limits = await this.limits(organizationId);
    if (!planAllowsFeature(limits.plan, feature)) {
      throw new Error(`Plan ${limits.plan} does not include ${feature}. Upgrade to use it.`);
    }
  }

  async createCheckoutSession(
    organizationId: string,
    userId: string,
    input: { plan: SubscriptionPlan; successUrl?: string | null; cancelUrl?: string | null },
  ): Promise<{ url: string }> {
    if (input.plan === SubscriptionPlan.FREE) {
      throw new Error("The FREE plan does not require checkout");
    }
    const priceId = process.env[PLAN_BY_PRICE_ENV[input.plan]];
    if (!priceId) {
      throw new Error(`Missing price configuration for plan ${input.plan}`);
    }
    const [subscription, organization, user] = await Promise.all([
      this.subscription(organizationId),
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true },
      }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
    ]);

    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.createCustomer({
        email: user.email,
        name: organization.name,
        organizationId,
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = (process.env.PUBLIC_WEB_URL || "http://localhost:5173").replace(/\/$/, "");
    const session = await this.stripe.createCheckoutSession({
      priceId,
      customerId,
      customerEmail: user.email,
      organizationId,
      successUrl: input.successUrl || `${appUrl}/billing?checkout=success`,
      cancelUrl: input.cancelUrl || `${appUrl}/billing?checkout=cancelled`,
    });
    await auditService.log({
      userId,
      organizationId,
      action: "BILLING_CHECKOUT_STARTED",
      entity: "Subscription",
      entityId: subscription.id,
      meta: { plan: input.plan },
    });
    return { url: session.url };
  }

  async createPortalSession(
    organizationId: string,
    userId: string,
    returnUrl?: string | null,
  ): Promise<{ url: string }> {
    const subscription = await this.subscription(organizationId);
    if (!subscription.stripeCustomerId) {
      throw new Error("No Stripe customer for this organization yet");
    }
    const appUrl = (process.env.PUBLIC_WEB_URL || "http://localhost:5173").replace(/\/$/, "");
    const session = await this.stripe.createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: returnUrl || `${appUrl}/billing`,
    });
    await auditService.log({
      userId,
      organizationId,
      action: "BILLING_PORTAL_OPENED",
      entity: "Subscription",
      entityId: subscription.id,
    });
    return { url: session.url };
  }

  /** Applies a verified Stripe event to the local subscription/invoice state. */
  async handleStripeEvent(event: StripeEvent): Promise<void> {
    const object = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const organizationId =
          (object.client_reference_id as string | undefined) ??
          ((object.metadata as Record<string, string> | undefined)?.organizationId ?? null);
        if (!organizationId) return;
        await this.applySubscription(organizationId, {
          stripeCustomerId: (object.customer as string | undefined) ?? null,
          stripeSubscriptionId: (object.subscription as string | undefined) ?? null,
          status: SubscriptionStatus.ACTIVE,
        });
        return;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        const customerId = object.customer as string | undefined;
        if (!customerId) return;
        const subscription = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!subscription) return;
        const items = object.items as { data?: { price?: { id?: string } }[] } | undefined;
        const priceId = items?.data?.[0]?.price?.id;
        await this.applySubscription(subscription.organizationId, {
          stripeSubscriptionId: (object.id as string | undefined) ?? null,
          status:
            event.type === "customer.subscription.deleted"
              ? SubscriptionStatus.CANCELLED
              : statusFromStripe((object.status as string | undefined) ?? "active"),
          plan:
            event.type === "customer.subscription.deleted"
              ? SubscriptionPlan.FREE
              : this.planForPrice(priceId),
          currentPeriodEnd: object.current_period_end
            ? new Date(Number(object.current_period_end) * 1000)
            : null,
          cancelAtPeriodEnd: !!object.cancel_at_period_end,
        });
        return;
      }
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalized": {
        const customerId = object.customer as string | undefined;
        if (!customerId) return;
        const subscription = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!subscription) return;
        const stripeInvoiceId = object.id as string;
        const data = {
          organizationId: subscription.organizationId,
          stripeInvoiceId,
          number: (object.number as string | undefined) ?? null,
          status: invoiceStatusFromStripe(object.status as string | undefined),
          amountDue: Math.round(Number(object.amount_due ?? 0)),
          amountPaid: Math.round(Number(object.amount_paid ?? 0)),
          currency: ((object.currency as string | undefined) ?? DEFAULT_CURRENCY).toUpperCase(),
          hostedInvoiceUrl: (object.hosted_invoice_url as string | undefined) ?? null,
          issuedAt: object.created ? new Date(Number(object.created) * 1000) : null,
        };
        await prisma.invoice.upsert({
          where: { stripeInvoiceId },
          create: data,
          update: data,
        });
        if (event.type === "invoice.payment_failed") {
          await this.applySubscription(subscription.organizationId, {
            status: SubscriptionStatus.PAST_DUE,
          });
        }
        return;
      }
      default:
        return;
    }
  }

  private planForPrice(priceId: string | undefined): SubscriptionPlan | undefined {
    if (!priceId) return undefined;
    if (priceId === process.env.STRIPE_PRICE_BUSINESS) return SubscriptionPlan.BUSINESS;
    if (priceId === process.env.STRIPE_PRICE_PRO) return SubscriptionPlan.PRO;
    return undefined;
  }

  private async applySubscription(
    organizationId: string,
    patch: {
      plan?: SubscriptionPlan;
      status?: SubscriptionStatus;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
    },
  ): Promise<void> {
    await this.subscription(organizationId);
    const updated = await prisma.subscription.update({
      where: { organizationId },
      data: {
        ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.stripeCustomerId ? { stripeCustomerId: patch.stripeCustomerId } : {}),
        ...(patch.stripeSubscriptionId
          ? { stripeSubscriptionId: patch.stripeSubscriptionId }
          : {}),
        ...(patch.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: patch.currentPeriodEnd }
          : {}),
        ...(patch.cancelAtPeriodEnd !== undefined
          ? { cancelAtPeriodEnd: patch.cancelAtPeriodEnd }
          : {}),
      },
    });
    await auditService.log({
      organizationId,
      action: "SUBSCRIPTION_UPDATED",
      entity: "Subscription",
      entityId: updated.id,
      meta: { plan: updated.plan, status: updated.status },
    });
    eventBus.emit("subscription.updated", {
      organizationId,
      subscriptionId: updated.id,
      plan: updated.plan,
      status: updated.status,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
    } satisfies SubscriptionEventPayload);
  }
}

export const billingService = new BillingService();
