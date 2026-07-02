import { prisma } from "../utils/prisma";
import { hashPassword, comparePassword } from "../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean };
  tokens: AuthTokens;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await hashPassword(input.password);
    const emailVerifyToken = uuid();

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        emailVerifyToken,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email);

    await prisma.auditLog.create({
      data: { userId: user.id, action: "USER_REGISTERED", entity: "User", entityId: user.id },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
      },
      tokens,
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid credentials");

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const tokens = await this.issueTokens(user.id, user.email);

    await prisma.auditLog.create({
      data: { userId: user.id, action: "USER_LOGIN", entity: "User", entityId: user.id },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
      },
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.refreshTokenHash) throw new Error("Invalid refresh token");

    const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!valid) throw new Error("Invalid refresh token");

    return this.issueTokens(user.id, user.email);
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user) throw new Error("Invalid verification token");

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    });

    return true;
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return true; // don't reveal if email exists

    const resetToken = uuid();
    const expires = new Date(Date.now() + 3600_000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: resetToken, resetPasswordExpires: expires },
    });

    // In production: send email with resetToken
    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });
    if (!user) throw new Error("Invalid or expired reset token");

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshTokenHash: null,
      },
    });

    return true;
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        avatarUrl: true,
        phone: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error("User not found");
    return user;
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = generateAccessToken({ userId, email });
    const refreshToken = generateRefreshToken({ userId, email });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
