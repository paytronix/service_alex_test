export enum CatalogEntity {
  DEPARTMENT = "Department",
  ROLE = "Role",
  SKILL = "Skill",
  SHIFT_TEMPLATE = "ShiftTemplate",
}

export interface DepartmentDto {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDto {
  id: string;
  name: string;
  color: string;
  description: string | null;
  maxLoad: number | null;
  hourlyRate: number | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDto {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftTemplateDto {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  breakMinutes: number;
  minEmployees: number;
  maxEmployees: number;
  roleId: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
