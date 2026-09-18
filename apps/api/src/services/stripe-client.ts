import { createHmac, timingSafeEqual } from "crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customer?: string | null;
}

export interface StripePortalSession {
  id: string;
  url: string;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured: set STRIPE_SECRET_KEY");
  }
}

/**
 * Minimal Stripe REST client. Only the endpoints used by billing are covered,
 * which avoids pulling the full SDK into the API bundle.
 */
export class StripeClient {
  private get secretKey(): string {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new StripeNotConfiguredError();
    return key;
  }

  get configured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  async createCheckoutSession(params: {
    priceId: string;
    customerId?: string | null;
    customerEmail?: string | null;
    organizationId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<StripeCheckoutSession> {
    return this.post<StripeCheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.organizationId,
      "metadata[organizationId]": params.organizationId,
      ...(params.customerId
        ? { customer: params.customerId }
        : params.customerEmail
          ? { customer_email: params.customerEmail }
          : {}),
    });
  }

  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<StripePortalSession> {
    return this.post<StripePortalSession>("/billing_portal/sessions", {
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  async createCustomer(params: {
    email?: string | null;
    name?: string | null;
    organizationId: string;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>("/customers", {
      ...(params.email ? { email: params.email } : {}),
      ...(params.name ? { name: params.name } : {}),
      "metadata[organizationId]": params.organizationId,
    });
  }

  /**
   * Verifies the `Stripe-Signature` header over the raw request body.
   * Throws when the signature is missing, stale or does not match.
   */
  verifyWebhook(rawBody: Buffer | string, signatureHeader: string | undefined): StripeEvent {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Stripe is not configured: set STRIPE_WEBHOOK_SECRET");
    if (!signatureHeader) throw new Error("Missing Stripe-Signature header");

    const parts = new Map(
      signatureHeader.split(",").map((part) => {
        const [key, ...value] = part.trim().split("=");
        return [key, value.join("=")];
      }),
    );
    const timestamp = parts.get("t");
    const signature = parts.get("v1");
    if (!timestamp || !signature) throw new Error("Malformed Stripe-Signature header");

    const toleranceSeconds = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? 300);
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new Error("Stripe webhook timestamp outside the tolerance window");
    }

    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new Error("Stripe webhook signature mismatch");
    }
    return JSON.parse(body) as StripeEvent;
  }

  private async post<T>(path: string, form: Record<string, string>): Promise<T> {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json()) as T & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Stripe request failed (${response.status})`);
    }
    return payload;
  }
}

export const stripeClient = new StripeClient();
