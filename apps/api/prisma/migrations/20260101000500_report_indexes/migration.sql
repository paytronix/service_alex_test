CREATE INDEX "shift_assignments_organizationId_date_idx" ON "shift_assignments"("organizationId", "date");
CREATE INDEX "shift_requirements_organizationId_date_idx" ON "shift_requirements"("organizationId", "date");
CREATE INDEX "shift_requirements_scheduleId_idx" ON "shift_requirements"("scheduleId");
CREATE INDEX "schedules_organizationId_status_idx" ON "schedules"("organizationId", "status");
CREATE INDEX "leave_requests_organizationId_status_idx" ON "leave_requests"("organizationId", "status");
CREATE INDEX "leave_requests_employeeId_startDate_idx" ON "leave_requests"("employeeId", "startDate");
CREATE INDEX "employees_organizationId_status_idx" ON "employees"("organizationId", "status");
CREATE INDEX "employees_organizationId_departmentId_idx" ON "employees"("organizationId", "departmentId");
