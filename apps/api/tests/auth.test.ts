import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, comparePassword } from "../src/utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/utils/jwt";

describe("Password utils", () => {
  it("should hash and verify password", async () => {
    const password = "TestPass123!";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
    expect(await comparePassword("wrong", hash)).toBe(false);
  });
});

describe("JWT utils", () => {
  const payload = { userId: "user-1", email: "test@example.com" };

  it("should generate and verify access token", () => {
    const token = generateAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it("should generate and verify refresh token", () => {
    const token = generateRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it("should reject invalid token", () => {
    expect(() => verifyAccessToken("invalid-token")).toThrow();
  });

  it("should not verify access token with refresh secret", () => {
    const accessToken = generateAccessToken(payload);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

describe("Slug generation", () => {
  it("should generate URL-safe slug", async () => {
    const { generateSlug } = await import("../src/utils/slug");
    expect(generateSlug("My Organization")).toBe("my-organization");
    expect(generateSlug("Test & Demo!")).toBe("test-demo");
    expect(generateSlug("  leading trailing  ")).toBe("leading-trailing");
  });
});
