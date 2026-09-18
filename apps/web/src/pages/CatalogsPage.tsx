import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  CREATE_DEPARTMENT_MUTATION,
  CREATE_ROLE_MUTATION,
  CREATE_SHIFT_TEMPLATE_MUTATION,
  CREATE_SKILL_MUTATION,
  DELETE_DEPARTMENT_MUTATION,
  DELETE_ROLE_MUTATION,
  DELETE_SHIFT_TEMPLATE_MUTATION,
  DELETE_SKILL_MUTATION,
  DEPARTMENTS_QUERY,
  MY_ORGANIZATIONS_QUERY,
  ROLES_QUERY,
  SHIFT_TEMPLATES_QUERY,
  SKILLS_QUERY,
  UPDATE_DEPARTMENT_MUTATION,
  UPDATE_ROLE_MUTATION,
  UPDATE_SHIFT_TEMPLATE_MUTATION,
  UPDATE_SKILL_MUTATION,
} from "../lib/graphql";
import { NameCatalogSection } from "../components/catalogs/NameCatalogSection";
import {
  RoleCatalogSection,
  RoleFormValues,
  RoleItem,
} from "../components/catalogs/RoleCatalogSection";
import {
  ShiftTemplateCatalogSection,
  ShiftTemplateFormValues,
  ShiftTemplateItem,
} from "../components/catalogs/ShiftTemplateCatalogSection";
import { canManageCatalogs } from "../components/catalogs/permissions";

type CatalogTab = "departments" | "roles" | "skills" | "shiftTemplates";

const TABS: { key: CatalogTab; label: string }[] = [
  { key: "departments", label: "Departments" },
  { key: "roles", label: "Roles" },
  { key: "skills", label: "Skills" },
  { key: "shiftTemplates", label: "Shift Templates" },
];

interface OrganizationOption {
  id: string;
  name: string;
  role: string;
}

function optionalInt(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number.parseInt(trimmed, 10);
}

function optionalFloat(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number.parseFloat(trimmed);
}

function DepartmentsTab({ organizationId, canManage }: TabProps) {
  const { data, loading } = useQuery(DEPARTMENTS_QUERY, { variables: { organizationId } });
  const refetchQueries = [{ query: DEPARTMENTS_QUERY, variables: { organizationId } }];
  const [createDepartment] = useMutation(CREATE_DEPARTMENT_MUTATION, { refetchQueries });
  const [updateDepartment] = useMutation(UPDATE_DEPARTMENT_MUTATION, { refetchQueries });
  const [deleteDepartment] = useMutation(DELETE_DEPARTMENT_MUTATION, { refetchQueries });

  return (
    <NameCatalogSection
      title="Departments"
      entityLabel="department"
      items={data?.departments ?? []}
      loading={loading}
      canManage={canManage}
      onCreate={async (name) => {
        await createDepartment({ variables: { organizationId, name } });
      }}
      onUpdate={async (id, name) => {
        await updateDepartment({ variables: { organizationId, id, name } });
      }}
      onDelete={async (id) => {
        await deleteDepartment({ variables: { organizationId, id } });
      }}
    />
  );
}

function SkillsTab({ organizationId, canManage }: TabProps) {
  const { data, loading } = useQuery(SKILLS_QUERY, { variables: { organizationId } });
  const refetchQueries = [{ query: SKILLS_QUERY, variables: { organizationId } }];
  const [createSkill] = useMutation(CREATE_SKILL_MUTATION, { refetchQueries });
  const [updateSkill] = useMutation(UPDATE_SKILL_MUTATION, { refetchQueries });
  const [deleteSkill] = useMutation(DELETE_SKILL_MUTATION, { refetchQueries });

  return (
    <NameCatalogSection
      title="Skills"
      entityLabel="skill"
      items={data?.skills ?? []}
      loading={loading}
      canManage={canManage}
      onCreate={async (name) => {
        await createSkill({ variables: { organizationId, name } });
      }}
      onUpdate={async (id, name) => {
        await updateSkill({ variables: { organizationId, id, name } });
      }}
      onDelete={async (id) => {
        await deleteSkill({ variables: { organizationId, id } });
      }}
    />
  );
}

function RolesTab({ organizationId, canManage }: TabProps) {
  const { data, loading } = useQuery(ROLES_QUERY, { variables: { organizationId } });
  const refetchQueries = [{ query: ROLES_QUERY, variables: { organizationId } }];
  const [createRole] = useMutation(CREATE_ROLE_MUTATION, { refetchQueries });
  const [updateRole] = useMutation(UPDATE_ROLE_MUTATION, { refetchQueries });
  const [deleteRole] = useMutation(DELETE_ROLE_MUTATION, { refetchQueries });

  const toVariables = (values: RoleFormValues) => ({
    organizationId,
    name: values.name,
    color: values.color,
    description: values.description,
    maxLoad: optionalInt(values.maxLoad),
    hourlyRate: optionalFloat(values.hourlyRate),
  });

  const roles: RoleItem[] = data?.roles ?? [];

  return (
    <RoleCatalogSection
      items={roles}
      loading={loading}
      canManage={canManage}
      onCreate={async (values) => {
        await createRole({ variables: toVariables(values) });
      }}
      onUpdate={async (id, values) => {
        await updateRole({ variables: { ...toVariables(values), id } });
      }}
      onDelete={async (id) => {
        await deleteRole({ variables: { organizationId, id } });
      }}
    />
  );
}

function ShiftTemplatesTab({ organizationId, canManage }: TabProps) {
  const { data, loading } = useQuery(SHIFT_TEMPLATES_QUERY, { variables: { organizationId } });
  const { data: rolesData } = useQuery(ROLES_QUERY, { variables: { organizationId } });
  const refetchQueries = [{ query: SHIFT_TEMPLATES_QUERY, variables: { organizationId } }];
  const [createTemplate] = useMutation(CREATE_SHIFT_TEMPLATE_MUTATION, { refetchQueries });
  const [updateTemplate] = useMutation(UPDATE_SHIFT_TEMPLATE_MUTATION, { refetchQueries });
  const [deleteTemplate] = useMutation(DELETE_SHIFT_TEMPLATE_MUTATION, { refetchQueries });

  const toVariables = (values: ShiftTemplateFormValues) => ({
    organizationId,
    name: values.name,
    startTime: values.startTime,
    endTime: values.endTime,
    breakMinutes: optionalInt(values.breakMinutes),
    minEmployees: optionalInt(values.minEmployees),
    maxEmployees: optionalInt(values.maxEmployees),
    roleId: values.roleId === "" ? null : values.roleId,
  });

  const templates: ShiftTemplateItem[] = data?.shiftTemplates ?? [];

  return (
    <ShiftTemplateCatalogSection
      items={templates}
      roles={rolesData?.roles ?? []}
      loading={loading}
      canManage={canManage}
      onCreate={async (values) => {
        await createTemplate({ variables: toVariables(values) });
      }}
      onUpdate={async (id, values) => {
        await updateTemplate({ variables: { ...toVariables(values), id } });
      }}
      onDelete={async (id) => {
        await deleteTemplate({ variables: { organizationId, id } });
      }}
    />
  );
}

interface TabProps {
  organizationId: string;
  canManage: boolean;
}

export function CatalogsPage() {
  const { data, loading } = useQuery(MY_ORGANIZATIONS_QUERY);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CatalogTab>("departments");

  const organizations: OrganizationOption[] = data?.myOrganizations ?? [];
  const organizationId = selectedOrgId ?? organizations[0]?.id ?? null;
  const organization = organizations.find((org) => org.id === organizationId);
  const canManage = canManageCatalogs(organization?.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Catalogs</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading organizations...</p>
        ) : !organizationId ? (
          <p className="text-sm text-gray-500">
            Create an organization first to manage its catalogs.
          </p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <label className="text-sm text-gray-600">
                Organization
                <select
                  aria-label="Organization"
                  value={organizationId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="ml-2 rounded-md border border-gray-300 px-3 py-2"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>
              {!canManage && (
                <span className="text-sm text-gray-500">
                  Read-only access — only Owners and Managers can edit catalogs.
                </span>
              )}
            </div>

            <nav className="mb-6 flex gap-2 border-b">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm ${
                    activeTab === tab.key
                      ? "border-b-2 border-primary-600 font-medium text-primary-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeTab === "departments" && (
              <DepartmentsTab organizationId={organizationId} canManage={canManage} />
            )}
            {activeTab === "roles" && (
              <RolesTab organizationId={organizationId} canManage={canManage} />
            )}
            {activeTab === "skills" && (
              <SkillsTab organizationId={organizationId} canManage={canManage} />
            )}
            {activeTab === "shiftTemplates" && (
              <ShiftTemplatesTab organizationId={organizationId} canManage={canManage} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
