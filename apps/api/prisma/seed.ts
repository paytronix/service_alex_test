import {
  AvailabilityType,
  CertificationStatus,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  MembershipRole,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  OpenShiftStatus,
  PayPeriodStatus,
  ScheduleChangeType,
  SubscriptionPlan,
  SubscriptionStatus,
  TimeEntrySource,
  TimeEntryStatus,
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

  const mainLocation = await prisma.location.upsert({
    where: { name_organizationId: { name: "Main street", organizationId: organization.id } },
    update: { isDefault: true },
    create: {
      organizationId: organization.id,
      name: "Main street",
      timezone: "UTC",
      address: "1 Main street",
      isDefault: true,
    },
  });
  await prisma.location.upsert({
    where: { name_organizationId: { name: "Riverside", organizationId: organization.id } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Riverside",
      timezone: "UTC",
      address: "42 River road",
    },
  });

  const hallCalendar = await prisma.calendar.upsert({
    where: { name_organizationId: { name: "Hall", organizationId: organization.id } },
    update: { locationId: mainLocation.id },
    create: {
      organizationId: organization.id,
      locationId: mainLocation.id,
      name: "Hall",
      color: "#3B82F6",
    },
  });
  await prisma.calendar.upsert({
    where: { name_organizationId: { name: "Kitchen", organizationId: organization.id } },
    update: { locationId: mainLocation.id },
    create: {
      organizationId: organization.id,
      locationId: mainLocation.id,
      name: "Kitchen",
      color: "#F97316",
    },
  });

  await prisma.employee.update({
    where: { id: emma.id },
    data: { locationId: mainLocation.id },
  });
  await prisma.employee.update({
    where: { id: liam.id },
    data: { locationId: mainLocation.id },
  });

  const summerTemplate = await prisma.weekTemplate.upsert({
    where: { name_organizationId: { name: "Summer", organizationId: organization.id } },
    update: { locationId: mainLocation.id, calendarId: hallCalendar.id },
    create: {
      organizationId: organization.id,
      locationId: mainLocation.id,
      calendarId: hallCalendar.id,
      name: "Summer",
      description: "Busy season staffing pattern",
    },
  });

  const summerRules = [
    { dayOfWeek: 1, shiftTemplateId: morningTemplate.id, roleId: barista.id, requiredCount: 2 },
    { dayOfWeek: 5, shiftTemplateId: nightTemplate.id, roleId: cook.id, requiredCount: 1 },
  ];
  for (const rule of summerRules) {
    const existingRule = await prisma.recurringShiftRule.findFirst({
      where: {
        organizationId: organization.id,
        weekTemplateId: summerTemplate.id,
        dayOfWeek: rule.dayOfWeek,
        shiftTemplateId: rule.shiftTemplateId,
      },
    });
    if (!existingRule) {
      await prisma.recurringShiftRule.create({
        data: { organizationId: organization.id, weekTemplateId: summerTemplate.id, ...rule },
      });
    }
  }

  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)),
  );
  const existingSchedule = await prisma.schedule.findFirst({
    where: {
      organizationId: organization.id,
      weekStartDate: monday,
      locationId: mainLocation.id,
      calendarId: hallCalendar.id,
    },
  });
  const schedule =
    existingSchedule ??
    (await prisma.schedule.create({
      data: {
        organizationId: organization.id,
        weekStartDate: monday,
        locationId: mainLocation.id,
        calendarId: hallCalendar.id,
      },
    }));

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

  const ownerUser = users[0];

  const existingNotification = await prisma.notification.findFirst({
    where: { organizationId: organization.id, recipientId: employeeUser.id },
  });
  if (!existingNotification) {
    await prisma.notification.createMany({
      data: [
        {
          organizationId: organization.id,
          recipientId: employeeUser.id,
          type: NotificationType.SCHEDULE_PUBLISHED,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          title: "Schedule published",
          body: "The schedule for the current week has been published.",
          payload: { scheduleId: schedule.id, version: schedule.version },
          sentAt: new Date(),
        },
        {
          organizationId: organization.id,
          recipientId: employeeUser.id,
          type: NotificationType.SHIFT_ASSIGNED,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          title: "New shift assigned",
          body: "You are scheduled for the morning shift.",
          sentAt: new Date(),
        },
      ],
    });
  }

  const existingHistory = await prisma.shiftAssignmentHistory.findFirst({
    where: { scheduleId: schedule.id },
  });
  const firstAssignment = await prisma.shiftAssignment.findFirst({
    where: { scheduleId: schedule.id },
  });
  if (!existingHistory && firstAssignment) {
    await prisma.shiftAssignmentHistory.create({
      data: {
        organizationId: organization.id,
        scheduleId: schedule.id,
        assignmentId: firstAssignment.id,
        changeType: ScheduleChangeType.CREATED,
        date: firstAssignment.date,
        newEmployeeId: firstAssignment.employeeId,
        changedById: ownerUser.id,
      },
    });
  }

  const existingAudit = await prisma.auditLog.findFirst({
    where: { organizationId: organization.id, action: "SCHEDULE_PUBLISHED" },
  });
  if (!existingAudit) {
    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: ownerUser.id,
        action: "SCHEDULE_PUBLISHED",
        entity: "Schedule",
        entityId: schedule.id,
        meta: { version: schedule.version },
      },
    });
  }

  // ── Epic 10: rates, time tracking, open shifts, certifications, billing ──

  await prisma.role.update({
    where: { id: barista.id },
    data: { hourlyRate: 18.5 },
  });
  await prisma.role.update({
    where: { id: cook.id },
    data: { hourlyRate: 21, requiredCertifications: ["Food safety"] },
  });
  await prisma.employee.update({ where: { id: emma.id }, data: { hourlyRate: 19.75 } });

  const emmaAssignment = await prisma.shiftAssignment.findFirst({
    where: { scheduleId: schedule.id, employeeId: emma.id, date: assignmentDate },
  });
  const existingTimeEntry = await prisma.timeEntry.findFirst({
    where: { organizationId: organization.id, employeeId: emma.id },
  });
  if (!existingTimeEntry && emmaAssignment) {
    const clockInAt = new Date(`${assignmentDate.toISOString().slice(0, 10)}T08:07:00.000Z`);
    const clockOutAt = new Date(`${assignmentDate.toISOString().slice(0, 10)}T16:35:00.000Z`);
    await prisma.timeEntry.create({
      data: {
        organizationId: organization.id,
        employeeId: emma.id,
        shiftAssignmentId: emmaAssignment.id,
        clockInAt,
        clockOutAt,
        source: TimeEntrySource.WEB,
        status: TimeEntryStatus.CLOSED,
        note: "Late opening, stayed to close",
      },
    });
  }

  const existingPayPeriod = await prisma.payPeriod.findFirst({
    where: { organizationId: organization.id },
  });
  if (!existingPayPeriod) {
    await prisma.payPeriod.create({
      data: {
        organizationId: organization.id,
        from: monday,
        to: new Date(monday.getTime() + 13 * 86400000),
        status: PayPeriodStatus.OPEN,
      },
    });
  }

  const openShiftDate = new Date(assignmentDate.getTime() + 2 * 86400000);
  const existingOpenShift = await prisma.openShift.findFirst({
    where: { scheduleId: schedule.id, date: openShiftDate },
  });
  if (!existingOpenShift) {
    await prisma.openShift.create({
      data: {
        organizationId: organization.id,
        scheduleId: schedule.id,
        date: openShiftDate,
        shiftTemplateId: morningTemplate.id,
        roleId: barista.id,
        locationId: mainLocation.id,
        requiredCount: 1,
        status: OpenShiftStatus.OPEN,
        note: "Extra cover for the market day",
      },
    });
  }

  const existingCertification = await prisma.certification.findFirst({
    where: { organizationId: organization.id },
  });
  if (!existingCertification) {
    await prisma.certification.createMany({
      data: [
        {
          organizationId: organization.id,
          employeeId: liam.id,
          skillId: grill.id,
          name: "Food safety",
          issuedAt: new Date("2024-01-10"),
          expiresAt: new Date(Date.now() + 20 * 86400000),
          status: CertificationStatus.EXPIRING,
        },
        {
          organizationId: organization.id,
          employeeId: emma.id,
          name: "First aid",
          issuedAt: new Date("2023-06-01"),
          expiresAt: new Date(Date.now() + 365 * 86400000),
          status: CertificationStatus.VALID,
        },
      ],
    });
  }

  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
    },
  });

  console.log(`Seeded organization ${organization.slug} (password for all users: ${PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
