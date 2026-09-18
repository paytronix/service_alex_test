import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import {
  CREATE_RECURRING_RULE_MUTATION,
  CREATE_WEEK_TEMPLATE_MUTATION,
  DELETE_RECURRING_RULE_MUTATION,
  DELETE_WEEK_TEMPLATE_MUTATION,
  GENERATE_SCHEDULE_FROM_TEMPLATE_MUTATION,
  SAVE_WEEK_AS_TEMPLATE_MUTATION,
  WEEK_TEMPLATES_QUERY,
} from "../../lib/graphql";
import type { SchedulerRole, SchedulerTemplate, SchedulerViolation } from "./types";

interface RecurringRule {
  id: string;
  dayOfWeek: number;
  shiftTemplateId: string;
  roleId: string | null;
  employeeId: string | null;
  requiredCount: number;
}

interface WeekTemplate {
  id: string;
  name: string;
  description: string | null;
  locationId: string | null;
  calendarId: string | null;
  rules: RecurringRule[];
}

interface GenerationResult {
  createdAssignmentIds: string[];
  createdRequirementIds: string[];
  skipped: Array<{ ruleId: string; date: string; reason: string }>;
  violations: SchedulerViolation[];
}

interface TemplatePanelProps {
  organizationId: string;
  weekStartDate: string;
  scheduleId: string | null;
  locationId: string | null;
  calendarId: string | null;
  shiftTemplates: SchedulerTemplate[];
  roles: SchedulerRole[];
  onGenerated: () => void;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TemplatePanel({
  organizationId,
  weekStartDate,
  scheduleId,
  locationId,
  calendarId,
  shiftTemplates,
  roles,
  onGenerated,
}: TemplatePanelProps) {
  const [templateName, setTemplateName] = useState("");
  const [saveName, setSaveName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [ruleDay, setRuleDay] = useState(1);
  const [ruleTemplateId, setRuleTemplateId] = useState("");
  const [ruleRoleId, setRuleRoleId] = useState("");
  const [ruleCount, setRuleCount] = useState(1);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templatesQuery = useQuery<{ weekTemplates: WeekTemplate[] }>(WEEK_TEMPLATES_QUERY, {
    variables: { organizationId, locationId },
    skip: !organizationId,
  });
  const refetchTemplates = [
    { query: WEEK_TEMPLATES_QUERY, variables: { organizationId, locationId } },
  ];
  const [createTemplate] = useMutation(CREATE_WEEK_TEMPLATE_MUTATION, {
    refetchQueries: refetchTemplates,
  });
  const [deleteTemplate] = useMutation(DELETE_WEEK_TEMPLATE_MUTATION, {
    refetchQueries: refetchTemplates,
  });
  const [createRule] = useMutation(CREATE_RECURRING_RULE_MUTATION, {
    refetchQueries: refetchTemplates,
  });
  const [deleteRule] = useMutation(DELETE_RECURRING_RULE_MUTATION, {
    refetchQueries: refetchTemplates,
  });
  const [generate, generateState] = useMutation<{
    generateScheduleFromTemplate: GenerationResult;
  }>(GENERATE_SCHEDULE_FROM_TEMPLATE_MUTATION);
  const [saveWeek] = useMutation(SAVE_WEEK_AS_TEMPLATE_MUTATION, {
    refetchQueries: refetchTemplates,
  });

  const templates = templatesQuery.data?.weekTemplates ?? [];
  const selected = templates.find((template) => template.id === selectedTemplateId) ?? null;

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action failed");
    }
  };

  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Week templates &amp; recurring rules</h2>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">New template name</span>
          <input
            className="rounded border px-2 py-1"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Summer"
          />
        </label>
        <button
          type="button"
          className="rounded bg-primary-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!templateName.trim()}
          onClick={() =>
            void run(async () => {
              await createTemplate({
                variables: {
                  organizationId,
                  name: templateName.trim(),
                  locationId,
                  calendarId,
                },
              });
              setTemplateName("");
            })
          }
        >
          Create template
        </button>
      </div>

      <label className="flex flex-col text-sm">
        <span className="text-gray-600">Template</span>
        <select
          className="rounded border px-2 py-1"
          value={selectedTemplateId}
          onChange={(event) => setSelectedTemplateId(event.target.value)}
        >
          <option value="">Select a template…</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="space-y-3 rounded bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Rules in {selected.name}</h3>
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={() =>
                void run(async () => {
                  await deleteTemplate({ variables: { organizationId, id: selected.id } });
                  setSelectedTemplateId("");
                })
              }
            >
              Delete template
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {selected.rules.length === 0 && <li className="text-gray-600">No rules yet.</li>}
            {selected.rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-2">
                <span>
                  {DAY_NAMES[rule.dayOfWeek]} ·{" "}
                  {shiftTemplates.find((item) => item.id === rule.shiftTemplateId)?.name ??
                    rule.shiftTemplateId}{" "}
                  · {roles.find((role) => role.id === rule.roleId)?.name ?? "any role"} ×{" "}
                  {rule.requiredCount}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() =>
                    void run(() => deleteRule({ variables: { organizationId, id: rule.id } }))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Day</span>
              <select
                className="rounded border px-2 py-1"
                value={ruleDay}
                onChange={(event) => setRuleDay(Number(event.target.value))}
              >
                {DAY_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Shift</span>
              <select
                className="rounded border px-2 py-1"
                value={ruleTemplateId}
                onChange={(event) => setRuleTemplateId(event.target.value)}
              >
                <option value="">Select…</option>
                {shiftTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Role</span>
              <select
                className="rounded border px-2 py-1"
                value={ruleRoleId}
                onChange={(event) => setRuleRoleId(event.target.value)}
              >
                <option value="">Any</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Count</span>
              <input
                type="number"
                min={1}
                className="w-20 rounded border px-2 py-1"
                value={ruleCount}
                onChange={(event) => setRuleCount(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              disabled={!ruleTemplateId}
              onClick={() =>
                void run(() =>
                  createRule({
                    variables: {
                      organizationId,
                      weekTemplateId: selected.id,
                      dayOfWeek: ruleDay,
                      shiftTemplateId: ruleTemplateId,
                      roleId: ruleRoleId || null,
                      requiredCount: ruleCount,
                    },
                  }),
                )
              }
            >
              Add rule
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          className="rounded bg-primary-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!selectedTemplateId || generateState.loading}
          onClick={() =>
            void run(async () => {
              const response = await generate({
                variables: {
                  organizationId,
                  weekStartDate,
                  weekTemplateId: selectedTemplateId,
                  locationId,
                  calendarId,
                },
              });
              setResult(response.data?.generateScheduleFromTemplate ?? null);
              onGenerated();
            })
          }
        >
          Generate week from template
        </button>
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">Save current week as</span>
          <input
            className="rounded border px-2 py-1"
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="Template name"
          />
        </label>
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          disabled={!scheduleId || !saveName.trim()}
          onClick={() =>
            void run(async () => {
              await saveWeek({
                variables: { organizationId, scheduleId, name: saveName.trim() },
              });
              setSaveName("");
            })
          }
        >
          Save week as template
        </button>
      </div>

      {result && (
        <div className="space-y-2 rounded bg-blue-50 p-3 text-sm">
          <p>
            Created {result.createdAssignmentIds.length} assignments and{" "}
            {result.createdRequirementIds.length} requirements.
          </p>
          {result.violations.length > 0 && (
            <div>
              <strong>Conflicts</strong>
              <ul className="list-disc pl-5">
                {result.violations.map((violation, index) => (
                  <li key={`${violation.code}-${index}`}>
                    [{violation.level}] {violation.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.skipped.length > 0 && (
            <div>
              <strong>Skipped</strong>
              <ul className="list-disc pl-5">
                {result.skipped.map((item) => (
                  <li key={`${item.ruleId}-${item.date}`}>
                    {item.date}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
