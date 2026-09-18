import express from "express";
import http from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MembershipRole } from "@prisma/client";
import { generateAccessToken } from "../src/utils/jwt";
import { createReportsRouter } from "../src/routes/reports";
import { prisma } from "../src/utils/prisma";

const suffix = `endpoint-${Date.now()}`;
let organizationId = "";
let managerId = "";
let employeeId = "";
let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: { name: `Endpoint ${suffix}`, slug: `endpoint-${suffix}` },
  });
  organizationId = organization.id;
  const manager = await prisma.user.create({
    data: { email: `endpoint-manager-${suffix}@example.test`, passwordHash: "hash", firstName: "Endpoint", lastName: "Manager" },
  });
  managerId = manager.id;
  const employee = await prisma.user.create({
    data: { email: `endpoint-employee-${suffix}@example.test`, passwordHash: "hash", firstName: "Endpoint", lastName: "Employee" },
  });
  employeeId = employee.id;
  await prisma.membership.createMany({
    data: [
      { organizationId, userId: managerId, role: MembershipRole.MANAGER },
      { organizationId, userId: employeeId, role: MembershipRole.EMPLOYEE },
    ],
  });
  const app = express();
  app.use("/api/reports", createReportsRouter());
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
});

describe("reports export HTTP endpoint", () => {
  const url = () =>
    `${baseUrl}/api/reports/export?organizationId=${organizationId}&type=WORK_HOURS&format=CSV&from=2026-01-01&to=2026-01-01`;

  it("requires authentication", async () => {
    const response = await fetch(url());
    expect(response.status).toBe(401);
  });

  it("rejects employees", async () => {
    const response = await fetch(url(), {
      headers: { Authorization: `Bearer ${generateAccessToken({ userId: employeeId, email: "employee@example.test" })}` },
    });
    expect(response.status).toBe(403);
  });

  it("returns an attachment for managers", async () => {
    const response = await fetch(url(), {
      headers: { Authorization: `Bearer ${generateAccessToken({ userId: managerId, email: "manager@example.test" })}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
  });
});
