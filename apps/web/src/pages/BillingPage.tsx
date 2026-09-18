import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import { PlanFeature, SubscriptionPlan } from "@shiftflow/shared";
import {
  CREATE_BILLING_PORTAL_SESSION_MUTATION,
  CREATE_CHECKOUT_SESSION_MUTATION,
  INVOICES_QUERY,
  MY_ORGANIZATIONS_QUERY,
  SUBSCRIPTION_QUERY,
} from "../lib/graphql";
import { canManageBilling } from "../components/operations/permissions";

interface SubscriptionData {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  employeeCount: number;
  locationCount: number;
  limits: {
    plan: SubscriptionPlan;
    maxEmployees: number | null;
    maxLocations: number | null;
    features: PlanFeature[];
  };
}

interface Invoice {
  id: string;
  stripeInvoiceId: string | null;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  issuedAt: string | null;
}

function money(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function BillingPage() {
  const organizations = useQuery(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations?.[0];
  const organizationId: string | undefined = organization?.id;
  const canManage = canManageBilling(organization?.role);
  const [error, setError] = useState<string | null>(null);

  const subscription = useQuery<{ subscription: SubscriptionData }>(SUBSCRIPTION_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const invoices = useQuery<{ invoices: Invoice[] }>(INVOICES_QUERY, {
    variables: { organizationId },
    skip: !organizationId || !canManage,
  });

  const [createCheckout] = useMutation(CREATE_CHECKOUT_SESSION_MUTATION);
  const [createPortal] = useMutation(CREATE_BILLING_PORTAL_SESSION_MUTATION);

  const run = async (action: () => Promise<string | null | undefined>) => {
    setError(null);
    try {
      const url = await action();
      if (url) window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  const data = subscription.data?.subscription;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Plan & billing</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {subscription.loading ? (
          <p className="text-gray-500">Loading subscription...</p>
        ) : !data ? (
          <p className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">
            No subscription information available.
          </p>
        ) : (
          <>
            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-base font-semibold">Current plan</h2>
              <p className="mt-2 text-2xl font-bold text-primary-700">{data.plan}</p>
              <p className="text-sm text-gray-600">
                Status {data.status}
                {data.currentPeriodEnd
                  ? ` · renews ${data.currentPeriodEnd.slice(0, 10)}`
                  : ""}
                {data.cancelAtPeriodEnd ? " · cancels at period end" : ""}
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-gray-500">Employees</dt>
                  <dd className="text-lg text-gray-800">
                    {data.employeeCount}
                    {data.limits.maxEmployees === null ? " / unlimited" : ` / ${data.limits.maxEmployees}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Locations</dt>
                  <dd className="text-lg text-gray-800">
                    {data.locationCount}
                    {data.limits.maxLocations === null ? " / unlimited" : ` / ${data.limits.maxLocations}`}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.values(PlanFeature).map((feature) => (
                  <span
                    key={feature}
                    className={`rounded px-2 py-0.5 text-xs ${
                      data.limits.features.includes(feature)
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </section>

            {canManage ? (
              <section className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-base font-semibold">Change plan</h2>
                <div className="flex flex-wrap gap-3">
                  {[SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS].map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      disabled={data.plan === plan}
                      onClick={() =>
                        run(async () => {
                          const result = await createCheckout({ variables: { organizationId, plan } });
                          return result.data?.createCheckoutSession?.url;
                        })
                      }
                      className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      Upgrade to {plan}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      run(async () => {
                        const result = await createPortal({ variables: { organizationId } });
                        return result.data?.createBillingPortalSession?.url;
                      })
                    }
                    className="rounded-md border border-primary-600 px-4 py-2 text-sm text-primary-700 hover:bg-primary-50"
                  >
                    Open customer portal
                  </button>
                </div>
              </section>
            ) : (
              <p className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
                Only the organization owner can change the plan.
              </p>
            )}

            {canManage && (
              <section className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-base font-semibold">Invoices</h2>
                {(invoices.data?.invoices ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500">No invoices yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-gray-500">
                      <tr>
                        <th className="p-2">Number</th>
                        <th className="p-2">Issued</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Due</th>
                        <th className="p-2">Paid</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {(invoices.data?.invoices ?? []).map((invoice) => (
                        <tr key={invoice.id} className="border-b last:border-0">
                          <td className="p-2">{invoice.number ?? invoice.stripeInvoiceId ?? invoice.id}</td>
                          <td className="p-2">{invoice.issuedAt ? invoice.issuedAt.slice(0, 10) : "—"}</td>
                          <td className="p-2">{invoice.status}</td>
                          <td className="p-2">{money(invoice.amountDue, invoice.currency)}</td>
                          <td className="p-2">{money(invoice.amountPaid, invoice.currency)}</td>
                          <td className="p-2 text-xs">
                            {invoice.hostedInvoiceUrl && (
                              <a
                                href={invoice.hostedInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary-600 hover:underline"
                              >
                                View
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
