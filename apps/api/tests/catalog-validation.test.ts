import { describe, it, expect } from "vitest";
import {
  DEFAULT_ROLE_COLOR,
  crossesMidnight,
  isHexColor,
  isTimeString,
  minutesToTime,
  normalizeName,
  shiftDurationMinutes,
  timeToMinutes,
} from "@shiftflow/shared";
import {
  assertNonNegative,
  assertPositive,
  assertValidColor,
  assertValidName,
  assertValidTime,
  isUniqueConstraintError,
  withUniqueName,
} from "../src/utils/catalog";

describe("shared catalog validation", () => {
  it("validates hex colors", () => {
    expect(isHexColor(DEFAULT_ROLE_COLOR)).toBe(true);
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#GGGGGG")).toBe(false);
    expect(isHexColor("3B82F6")).toBe(false);
  });

  it("validates HH:MM times", () => {
    expect(isTimeString("00:00")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("9:00")).toBe(false);
  });

  it("converts between times and minutes", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
  });

  it("detects shifts crossing midnight", () => {
    expect(crossesMidnight("23:00", "08:00")).toBe(true);
    expect(crossesMidnight("08:00", "08:00")).toBe(true);
    expect(crossesMidnight("08:00", "16:00")).toBe(false);
  });

  it("computes shift duration across midnight", () => {
    expect(shiftDurationMinutes("08:00", "16:00")).toBe(480);
    expect(shiftDurationMinutes("23:00", "08:00")).toBe(540);
  });

  it("normalizes names", () => {
    expect(normalizeName("  Kitchen  ")).toBe("Kitchen");
  });
});

describe("api catalog assertions", () => {
  it("trims valid names and rejects blank ones", () => {
    expect(assertValidName("  Bar  ")).toBe("Bar");
    expect(() => assertValidName("   ")).toThrow("Name must not be empty");
  });

  it("uppercases valid colors and rejects invalid ones", () => {
    expect(assertValidColor("#ff8800")).toBe("#FF8800");
    expect(() => assertValidColor("blue")).toThrow("Invalid color");
  });

  it("rejects invalid times with a labelled message", () => {
    expect(assertValidTime("startTime", "09:00")).toBe("09:00");
    expect(() => assertValidTime("endTime", "25:00")).toThrow("Invalid endTime");
  });

  it("checks numeric bounds", () => {
    expect(assertPositive("maxLoad", 1)).toBe(1);
    expect(() => assertPositive("maxLoad", 0)).toThrow("must be a positive number");
    expect(assertNonNegative("hourlyRate", 0)).toBe(0);
    expect(() => assertNonNegative("hourlyRate", -1)).toThrow("must not be negative");
  });

  it("translates Prisma unique constraint errors", async () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError(new Error("boom"))).toBe(false);

    await expect(
      withUniqueName("Department", async () => {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }),
    ).rejects.toThrow("Department with this name already exists in the organization");
  });
});
