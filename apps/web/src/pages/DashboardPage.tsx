import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { useAuth } from "../providers/AuthProvider";
import {
  MY_ORGANIZATIONS_QUERY,
  CREATE_ORGANIZATION_MUTATION,
  INVITE_MUTATION,
  ORGANIZATION_MEMBERS_QUERY,
} from "../lib/graphql";

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role: string;
  createdAt: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { data, loading, refetch } = useQuery(MY_ORGANIZATIONS_QUERY);
  const [createOrg] = useMutation(CREATE_ORGANIZATION_MUTATION);
  const [invite] = useMutation(INVITE_MUTATION);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EMPLOYEE");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const { data: membersData } = useQuery(ORGANIZATION_MEMBERS_QUERY, {
    variables: { organizationId: selectedOrg },
    skip: !selectedOrg,
  });

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createOrg({ variables: { name: orgName } });
      setOrgName("");
      setShowCreateForm(false);
      refetch();
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    setInviting(true);
    setInviteMsg("");
    try {
      await invite({
        variables: { organizationId: selectedOrg, email: inviteEmail, role: inviteRole },
      });
      setInviteEmail("");
      setInviteMsg("Invitation sent!");
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const orgs: Organization[] = data?.myOrganizations ?? [];
  const members: Member[] = membersData?.organizationMembers ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">ShiftFlow</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={logout}
              className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Organizations</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
          >
            Create Organization
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateOrg}
            className="mb-6 flex gap-3 rounded-lg bg-white p-4 shadow"
          >
            <input
              type="text"
              placeholder="Organization name"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : orgs.length === 0 ? (
          <p className="text-gray-500">No organizations yet. Create one to get started.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <div
                key={org.id}
                className={`cursor-pointer rounded-lg bg-white p-5 shadow transition hover:shadow-md ${
                  selectedOrg === org.id ? "ring-2 ring-primary-500" : ""
                }`}
                onClick={() => setSelectedOrg(selectedOrg === org.id ? null : org.id)}
              >
                <h3 className="font-semibold">{org.name}</h3>
                <p className="text-sm text-gray-500">/{org.slug}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                    {org.role}
                  </span>
                  <span className="text-xs text-gray-400">{org.timezone}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedOrg && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold">Members</h3>
              {members.length === 0 ? (
                <p className="text-gray-500">No members loaded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2">
                          {m.userFirstName} {m.userLastName}
                        </td>
                        <td className="py-2 text-gray-600">{m.userEmail}</td>
                        <td className="py-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                            {m.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold">Invite Member</h3>
              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="MANAGER">Manager</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {inviting ? "Sending..." : "Invite"}
                </button>
              </form>
              {inviteMsg && (
                <p className="mt-2 text-sm text-gray-600">{inviteMsg}</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
