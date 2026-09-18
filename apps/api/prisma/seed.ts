import {
  AvailabilityType,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  MembershipRole,
  PrismaClient,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const organization = await prisma.organization.upsert({
    where: { slug: "demo-cafe" },
    update: {},
    create: { name: "Demo Cafe", slug: "demo-cafe", timezone: "UTC" },
  });

  const people = [
    { email: "owner@demo.test", firstName: "Olivia", lastName: "Owner", role: MembershipRole.OWNER },
    {
      email: "manager@demo.test",
      firstName: "Mark",
      lastName: "Manager",
      role: MembershipRole.MANAGER,
    },
    {
      email: "supervisor@demo.test",
      firstName: "Sara",
      lastName: "Supervisor",
      role: MembershipRole.SUPERVISOR,
    },
    {
      email: "employee@demo.test",
      firstName: "Emma",
      lastName: "Employee",
      role: MembershipRole.EMPLOYEE,
    },
  ];

  const users = [];
  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {},
      create: {
        email: person.email,
        passwordHash,
        firstName: person.firstName,
        lastName: person.lastName,
        emailVerified: true,
      },
    });
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: { role: person.role },
      create: { userId: user.id, organizationId: organization.id, role: person.role },
    });
    users.push(user);
  }

  const kitchen = await prisma.department.upsert({
    where: { name_organizationId: { name: "Kitchen", organizationId: organization.id } },
    update: {},
    create: { name: "Kitchen", organizationId: organization.id },
  });
  const floor = await prisma.department.upsert({
    where: { name_organizationId: { name: "Floor", organizationId: organization.id } },
    update: {},
    create: { name: "Floor", organizationId: organization.id },
  });

  const barista = await prisma.role.upsert({
    where: { name_organizationId: { name: "Barista", organizationId: organization.id } },
    update: {},
    create: { name: "Barista", organizationId: organization.id, color: "#8B5CF6" },
  });
  const cook = await prisma.role.upsert({
    where: { name_organizationId: { name: "Cook", organizationId: organization.id } },
    update: {},
    create: { name: "Cook", organizationId: organization.id, color: "#F97316" },
  });

  const latteArt = await prisma.skill.upsert({
    where: { name_organizationId: { name: "Latte art", organizationId: organization.id } },
    update: {},
    create: { name: "Latte art", organizationId: organization.id },
  });
  const grill = await prisma.skill.upsert({
    where: { name_organizationId: { name: "Grill", organizationId: organization.id } },
    update: {},
    create: { name: "Grill", organizationId: organization.id },
  });

  const employeeUser = users[3];

  const emma = await prisma.employee.upsert({
    where: { email_organizationId: { email: "employee@demo.test", organizationId: organization.id } },
    update: {},
    create: {
      organizationId: organization.id,
      userId: employeeUser.id,
      firstName: "Emma",
      lastName: "Employee",
      email: "employee@demo.test",
      phone: "+15550001111",
      hireDate: new Date("2024-03-01"),
      status: EmployeeStatus.WORKING,
      roleId: barista.id,
      departmentId: floor.id,
      maxHoursPerWeek: 40,
      maxConsecutiveShifts: 5,
      minRestHours: 11,
    },
  });

  const liam = await prisma.employee.upsert({
    where: { email_organizationId: { email: "liam@demo.test", organizationId: organization.id } },
    update: {},
    create: {
      organizationId: organization.id,
      firstName: "Liam",
      lastName: "Cookson",
      email: "liam@demo.test",
      hireDate: new Date("2023-11-15"),
      status: EmployeeStatus.WORKING,
      roleId: cook.id,
      departmentId: kitchen.id,
      maxHoursPerWeek: 35,
    },
  });

  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId: emma.id, skillId: latteArt.id } },
    update: {},
    create: { employeeId: emma.id, skillId: latteArt.id, level: 3 },
  });
  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId: liam.id, skillId: grill.id } },
    update: {},
    create: { employeeId: liam.id, skillId: grill.id, level: 2 },
  });

  const morningTemplate = await prisma.shiftTemplate.upsert({
    where: { name_organizationId: { name: "Morning", organizationId: organization.id } },
    update: { roleId: barista.id, startTime: "08:00", endTime: "16:00", breakMinutes: 30 },
    create: {
      name: "Morning",
      organizationId: organization.id,
      roleId: barista.id,
      startTime: "08:00",
      endTime: "16:00",
      breakMinutes: 30,
    },
  });
  const nightTemplate = await prisma.shiftTemplate.upsert({
    where: { name_organizationId: { name: "Night", organizationId: organization.id } },
    update: { roleId: cook.id, startTime: "22:00", endTime: "06:00", breakMinutes: 30 },
    create: {
      name: "Night",
      organizationId: organization.id,
      roleId: cook.id,
      startTime: "22:00",
      endTime: "06:00",
      crossesMidnight: true,
      breakMinutes: 30,
    },
  });

  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)),
  );
  const schedule = await prisma.schedule.upsert({
    where: {
      organizationId_weekStartDate: {
        organizationId: organization.id,
        weekStartDate: monday,
      },
    },
    update: {},
    create: { organizationId: organization.id, weekStartDate: monday },
  });

  const assignmentDate = monday;
  const existingEmmaAssignment = await prisma.shiftAssignment.findFirst({
    where: { scheduleId: schedule.id, employeeId: emma.id, date: assignmentDate },
  });
  if (existingEmmaAssignment) {
    await prisma.shiftAssignment.update({
      where: { id: existingEmmaAssignment.id },
      data: {
        organizationId: organization.id,
        shiftTemplateId: morningTemplate.id,
        roleId: barista.id,
        breakMinutes: morningTemplate.breakMinutes,
      },
    });
  } else {
    await prisma.shiftAssignment.create({
      data: {
        scheduleId: schedule.id,
        organizationId: organization.id,
        employeeId: emma.id,
        shiftTemplateId: morningTemplate.id,
        roleId: barista.id,
        date: assignmentDate,
        breakMinutes: morningTemplate.breakMinutes,
      },
    });
  }
  const liamAssignmentDate = new Date(assignmentDate.getTime() + 86400000);
  const existingLiamAssignment = await prisma.shiftAssignment.findFirst({
    where: { scheduleId: schedule.id, employeeId: liam.id, date: liamAssignmentDate },
  });
  if (existingLiamAssignment) {
    await prisma.shiftAssignment.update({
      where: { id: existingLiamAssignment.id },
      data: {
        organizationId: organization.id,
        shiftTemplateId: nightTemplate.id,
        roleId: cook.id,
        breakMinutes: nightTemplate.breakMinutes,
      },
    });
  } else {
    await prisma.shiftAssignment.create({
      data: {
        scheduleId: schedule.id,
        organizationId: organization.id,
        employeeId: liam.id,
        shiftTemplateId: nightTemplate.id,
        roleId: cook.id,
        date: liamAssignmentDate,
        breakMinutes: nightTemplate.breakMinutes,
      },
    });
  }

  await prisma.shiftRequirement.upsert({
    where: {
      scheduleId_date_shiftTemplateId_roleId: {
        scheduleId: schedule.id,
        date: assignmentDate,
        shiftTemplateId: morningTemplate.id,
        roleId: barista.id,
      },
    },
    update: { organizationId: organization.id, requiredCount: 2 },
    create: {
      organizationId: organization.id,
      scheduleId: schedule.id,
      date: assignmentDate,
      shiftTemplateId: morningTemplate.id,
      roleId: barista.id,
      requiredCount: 2,
    },
  });
  await prisma.shiftRequirement.upsert({
    where: {
      scheduleId_date_shiftTemplateId_roleId: {
        scheduleId: schedule.id,
        date: assignmentDate,
        shiftTemplateId: morningTemplate.id,
        roleId: cook.id,
      },
    },
    update: { organizationId: organization.id, requiredCount: 1 },
    create: {
      organizationId: organization.id,
      scheduleId: schedule.id,
      date: assignmentDate,
      shiftTemplateId: morningTemplate.id,
      roleId: cook.id,
      requiredCount: 1,
    },
  });

  const availability = [
    { dayOfWeek: 0, type: AvailabilityType.UNAVAILABLE, availableFrom: null },
    { dayOfWeek: 1, type: AvailabilityType.AVAILABLE, availableFrom: null },
    { dayOfWeek: 2, type: AvailabilityType.AVAILABLE, availableFrom: null },
    { dayOfWeek: 3, type: AvailabilityType.AVAILABLE_AFTER, availableFrom: "14:00" },
    { dayOfWeek: 4, type: AvailabilityType.AVAILABLE, availableFrom: null },
    { dayOfWeek: 5, type: AvailabilityType.AVAILABLE, availableFrom: null },
    { dayOfWeek: 6, type: AvailabilityType.UNAVAILABLE, availableFrom: null },
  ];
  for (const entry of availability) {
    await prisma.availability.upsert({
      where: { employeeId_dayOfWeek: { employeeId: emma.id, dayOfWeek: entry.dayOfWeek } },
      update: { type: entry.type, availableFrom: entry.availableFrom },
      create: { employeeId: emma.id, ...entry },
    });
  }

  const existingLeave = await prisma.leaveRequest.findFirst({
    where: { employeeId: emma.id, type: LeaveType.VACATION },
  });
  if (!existingLeave) {
    await prisma.leaveRequest.create({
      data: {
        employeeId: emma.id,
        organizationId: organization.id,
        type: LeaveType.VACATION,
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-10"),
        reason: "Summer holiday",
        status: LeaveStatus.PENDING,
      },
    });
  }

  console.log(`Seeded organization ${organization.slug} (password for all users: ${PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
