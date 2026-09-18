import { useState } from "react";
import { Link } from "react-router-dom";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { CalendarFeedScope, IntegrationType, WEBHOOK_EVENTS } from "@shiftflow/shared";
import {
  CALENDAR_FEED_TOKENS_QUERY,
  CALENDAR_FEED_URL_QUERY,
  CONNECT_INTEGRATION_MUTATION,
  CREATE_WEBHOOK_MUTATION,
  DELETE_WEBHOOK_MUTATION,
  DISCONNECT_INTEGRATION_MUTATION,
  INTEGRATION_CONNECTIONS_QUERY,
  ISSUE_CALENDAR_FEED_TOKEN_MUTATION,
  MY_ORGANIZATIONS_QUERY,
  REVOKE_CALENDAR_FEED_TOKEN_MUTATION,
  ROTATE_WEBHOOK_SECRET_MUTATION,
  UPDATE_WEBHOOK_MUTATION,
  WEBHOOKS_QUERY,
  WEBHOOK_DELIVERIES_QUERY,
} from "../lib/graphql";
import { canManageIntegrations } from "../components/operations/permissions";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  active: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  error: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

interface CalendarToken {
  id: string;
  employeeId: string | null;
  scope: string;
  token: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface IntegrationConnection {
  id: string;
  type: string;
  active: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

export function IntegrationsPage() {
  const client = useApolloClient();
  const organizations = useQuery(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations?.[0];
  const organizationId: string | undefined = organization?.id;
  const canManage = canManageIntegrations(organization?.role);

  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ url: "", description: "", events: [] as string[] });
  const [chat, setChat] = useState({ telegramChatId: "", botToken: "", slackWebhookUrl: "", googleCalendarId: "" });

  const webhooks = useQuery<{ webhooks: Webhook[] }>(WEBHOOKS_QUERY, {
    variables: { organizationId },
    skip: !organizationId || !canManage,
  });
  const deliveries = useQuery<{ webhookDeliveries: WebhookDelivery[] }>(WEBHOOK_DELIVERIES_QUERY, {
    variables: { organizationId, take: 20 },
    skip: !organizationId || !canManage,
  });
  const tokens = useQuery<{ calendarFeedTokens: CalendarToken[] }>(CALENDAR_FEED_TOKENS_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const connections = useQuery<{ integrationConnections: IntegrationConnection[] }>(
    INTEGRATION_CONNECTIONS_QUERY,
    { variables: { organizationId }, skip: !organizationId || !canManage },
  );

  const webhookRefetch = [
    { query: WEBHOOKS_QUERY, variables: { organizationId } },
    { query: WEBHOOK_DELIVERIES_QUERY, variables: { organizationId, take: 20 } },
  ];
  const tokenRefetch = [{ query: CALENDAR_FEED_TOKENS_QUERY, variables: { organizationId } }];
  const connectionRefetch = [{ query: INTEGRATION_CONNECTIONS_QUERY, variables: { organizationId } }];

  const [createWebhook] = useMutation(CREATE_WEBHOOK_MUTATION, { refetchQueries: webhookRefetch });
  const [updateWebhook] = useMutation(UPDATE_WEBHOOK_MUTATION, { refetchQueries: webhookRefetch });
  const [rotateSecret] = useMutation(ROTATE_WEBHOOK_SECRET_MUTATION);
  const [deleteWebhook] = useMutation(DELETE_WEBHOOK_MUTATION, { refetchQueries: webhookRefetch });
  const [issueToken] = useMutation(ISSUE_CALENDAR_FEED_TOKEN_MUTATION, { refetchQueries: tokenRefetch });
  const [revokeToken] = useMutation(REVOKE_CALENDAR_FEED_TOKEN_MUTATION, { refetchQueries: tokenRefetch });
  const [connectIntegration] = useMutation(CONNECT_INTEGRATION_MUTATION, {
    refetchQueries: connectionRefetch,
  });
  const [disconnectIntegration] = useMutation(DISCONNECT_INTEGRATION_MUTATION, {
    refetchQueries: connectionRefetch,
  });

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  const showFeedUrl = (token: string) =>
    run(async () => {
      const result = await client.query({
        query: CALENDAR_FEED_URL_QUERY,
        variables: { organizationId, token },
        fetchPolicy: "network-only",
      });
      setFeedUrl(result.data?.calendarFeedUrl ?? null);
    });

  const connection = (type: IntegrationType) =>
    (connections.data?.integrationConnections ?? []).find((item) => item.type === type);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Integrations</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-base font-semibold">Calendar subscription (iCal)</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                run(() =>
                  issueToken({ variables: { organizationId, scope: CalendarFeedScope.EMPLOYEE } }),
                )
              }
              className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
            >
              Get my iCal link
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() =>
                  run(() =>
                    issueToken({
                      variables: { organizationId, scope: CalendarFeedScope.ORGANIZATION },
                    }),
                  )
                }
                className="rounded-md border border-primary-600 px-4 py-2 text-sm text-primary-700 hover:bg-primary-50"
              >
                Get organization link
              </button>
            )}
          </div>
          {feedUrl && (
            <p className="mt-3 break-all rounded bg-gray-50 p-3 text-xs text-gray-700">{feedUrl}</p>
          )}
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="p-2">Scope</th>
                <th className="p-2">Created</th>
                <th className="p-2">Last used</th>
                <th className="p-2">State</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(tokens.data?.calendarFeedTokens ?? []).map((token) => (
                <tr key={token.id} className="border-b last:border-0">
                  <td className="p-2">{token.scope}</td>
                  <td className="p-2">{token.createdAt.slice(0, 10)}</td>
                  <td className="p-2">{token.lastUsedAt ? token.lastUsedAt.slice(0, 10) : "—"}</td>
                  <td className="p-2">{token.revokedAt ? "revoked" : "active"}</td>
                  <td className="flex gap-3 p-2 text-xs">
                    {!token.revokedAt && (
                      <>
                        <button
                          type="button"
                          className="text-primary-600 hover:underline"
                          onClick={() => showFeedUrl(token.token)}
                        >
                          Show URL
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => run(() => revokeToken({ variables: { organizationId, id: token.id } }))}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {canManage && (
          <>
            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-base font-semibold">Webhooks</h2>
              {secret && (
                <p className="mb-3 break-all rounded bg-amber-50 p-3 text-xs text-amber-800">
                  Signing secret (shown once): {secret}
                </p>
              )}
              <div className="space-y-3">
                <label className="block text-sm text-gray-600">
                  Endpoint URL
                  <input
                    value={form.url}
                    onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://example.com/hooks/shiftflow"
                    className="mt-1 w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Description
                  <input
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className="mt-1 w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <fieldset>
                  <legend className="text-sm text-gray-600">Events</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {WEBHOOK_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.events.includes(event)}
                          onChange={(changed) =>
                            setForm((current) => ({
                              ...current,
                              events: changed.target.checked
                                ? [...current.events, event]
                                : current.events.filter((item) => item !== event),
                            }))
                          }
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      const result = await createWebhook({
                        variables: {
                          organizationId,
                          url: form.url,
                          events: form.events,
                          description: form.description || null,
                          active: true,
                        },
                      });
                      setSecret(result.data?.createWebhook?.secret ?? null);
                      setForm({ url: "", description: "", events: [] });
                    })
                  }
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                >
                  Add webhook
                </button>
              </div>

              <table className="mt-6 w-full text-left text-sm">
                <thead className="border-b text-gray-500">
                  <tr>
                    <th className="p-2">URL</th>
                    <th className="p-2">Events</th>
                    <th className="p-2">Active</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(webhooks.data?.webhooks ?? []).map((webhook) => (
                    <tr key={webhook.id} className="border-b last:border-0">
                      <td className="p-2 break-all">{webhook.url}</td>
                      <td className="p-2 text-xs text-gray-600">{webhook.events.join(", ")}</td>
                      <td className="p-2">{webhook.active ? "yes" : "no"}</td>
                      <td className="flex flex-wrap gap-3 p-2 text-xs">
                        <button
                          type="button"
                          className="text-primary-600 hover:underline"
                          onClick={() =>
                            run(() =>
                              updateWebhook({
                                variables: { organizationId, id: webhook.id, active: !webhook.active },
                              }),
                            )
                          }
                        >
                          {webhook.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          className="text-amber-700 hover:underline"
                          onClick={() =>
                            run(async () => {
                              const result = await rotateSecret({
                                variables: { organizationId, id: webhook.id },
                              });
                              setSecret(result.data?.rotateWebhookSecret?.secret ?? null);
                            })
                          }
                        >
                          Rotate secret
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() =>
                            run(() => deleteWebhook({ variables: { organizationId, id: webhook.id } }))
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="mt-6 text-sm font-semibold text-gray-700">Recent deliveries</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="border-b text-gray-500">
                  <tr>
                    <th className="p-2">Event</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Attempts</th>
                    <th className="p-2">Response</th>
                    <th className="p-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(deliveries.data?.webhookDeliveries ?? []).map((delivery) => (
                    <tr key={delivery.id} className="border-b last:border-0">
                      <td className="p-2">{delivery.event}</td>
                      <td className="p-2">{delivery.status}</td>
                      <td className="p-2">{delivery.attempts}</td>
                      <td className="p-2">{delivery.responseCode ?? "—"}</td>
                      <td className="p-2 text-xs text-red-600">{delivery.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-base font-semibold">Chat & calendar connections</h2>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Telegram</h3>
                  <input
                    aria-label="Telegram chat id"
                    value={chat.telegramChatId}
                    placeholder="Chat ID"
                    onChange={(event) =>
                      setChat((current) => ({ ...current, telegramChatId: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    aria-label="Telegram bot token override"
                    value={chat.botToken}
                    placeholder="Bot token (optional, else env)"
                    onChange={(event) => setChat((current) => ({ ...current, botToken: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        connectIntegration({
                          variables: {
                            organizationId,
                            type: IntegrationType.TELEGRAM,
                            config: {
                              chatId: chat.telegramChatId,
                              ...(chat.botToken ? { botToken: chat.botToken } : {}),
                            },
                            active: true,
                          },
                        }),
                      )
                    }
                    className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
                  >
                    Connect Telegram
                  </button>
                  <ConnectionState
                    connection={connection(IntegrationType.TELEGRAM)}
                    onDisconnect={(id) =>
                      run(() => disconnectIntegration({ variables: { organizationId, id } }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Slack</h3>
                  <input
                    aria-label="Slack webhook url"
                    value={chat.slackWebhookUrl}
                    placeholder="https://hooks.slack.com/services/..."
                    onChange={(event) =>
                      setChat((current) => ({ ...current, slackWebhookUrl: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        connectIntegration({
                          variables: {
                            organizationId,
                            type: IntegrationType.SLACK,
                            config: { webhookUrl: chat.slackWebhookUrl },
                            active: true,
                          },
                        }),
                      )
                    }
                    className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
                  >
                    Connect Slack
                  </button>
                  <ConnectionState
                    connection={connection(IntegrationType.SLACK)}
                    onDisconnect={(id) =>
                      run(() => disconnectIntegration({ variables: { organizationId, id } }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Google Calendar</h3>
                  <input
                    aria-label="Google calendar id"
                    value={chat.googleCalendarId}
                    placeholder="calendar id"
                    onChange={(event) =>
                      setChat((current) => ({ ...current, googleCalendarId: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Google Calendar consumes the iCal feed above; store the target calendar id here.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        connectIntegration({
                          variables: {
                            organizationId,
                            type: IntegrationType.GOOGLE_CALENDAR,
                            config: { calendarId: chat.googleCalendarId },
                            active: true,
                          },
                        }),
                      )
                    }
                    className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
                  >
                    Save configuration
                  </button>
                  <ConnectionState
                    connection={connection(IntegrationType.GOOGLE_CALENDAR)}
                    onDisconnect={(id) =>
                      run(() => disconnectIntegration({ variables: { organizationId, id } }))
                    }
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ConnectionState({
  connection,
  onDisconnect,
}: {
  connection?: IntegrationConnection;
  onDisconnect: (id: string) => void;
}) {
  if (!connection) return <p className="text-xs text-gray-500">Not connected.</p>;
  return (
    <div className="space-y-1 text-xs text-gray-600">
      <p>Connected {connection.createdAt.slice(0, 10)} · {connection.active ? "active" : "inactive"}</p>
      <pre className="overflow-x-auto rounded bg-gray-50 p-2">{JSON.stringify(connection.config)}</pre>
      <button type="button" className="text-red-600 hover:underline" onClick={() => onDisconnect(connection.id)}>
        Disconnect
      </button>
    </div>
  );
}
