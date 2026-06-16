import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users, userSettings } from '../../db/schema/index';
import { hashPassword, comparePassword } from '../../utils/password';
import { signAuthToken } from '../../utils/jwt';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, SESSION_COOKIE_NAME } from '../../middleware/requireAuth';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../utils/errors';
import { env } from '../../config/env';
import { toUserDto, toUserSettingsDto } from './auth.dto';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function setSessionCookie(res: import('express').Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(body.password);

    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        passwordHash,
        displayName: body.displayName ?? null,
      })
      .returning();

    if (!user) {
      throw new BadRequestError('Failed to create user');
    }

    const [settings] = await db
      .insert(userSettings)
      .values({ userId: user.id })
      .returning();

    const token = signAuthToken(user.id);
    setSessionCookie(res, token);

    res.status(201).json({
      user: toUserDto(user),
      settings: toUserSettingsDto(settings!),
    });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await comparePassword(body.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = signAuthToken(user.id);
    setSessionCookie(res, token);

    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    res.json({
      user: toUserDto(user),
      settings: settings ? toUserSettingsDto(settings) : null,
    });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).end();
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId),
    });
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    res.json({
      user: toUserDto(user),
      settings: settings ? toUserSettingsDto(settings) : null,
    });
  }),
);
