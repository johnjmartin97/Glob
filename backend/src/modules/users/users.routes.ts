import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { userSettings } from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';
import { toUserSettingsDto } from '../auth/auth.dto';

export const usersRouter = Router();

usersRouter.use(requireAuth);

const updateSettingsSchema = z.object({
  weightUnit: z.enum(['kg', 'lb']).optional(),
  timezone: z.string().min(1).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
});

usersRouter.get(
  '/me/settings',
  asyncHandler(async (req, res) => {
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, req.userId),
    });
    if (!settings) {
      throw new NotFoundError('Settings not found');
    }
    res.json(toUserSettingsDto(settings));
  }),
);

usersRouter.patch(
  '/me/settings',
  asyncHandler(async (req, res) => {
    const body = updateSettingsSchema.parse(req.body);

    const [updated] = await db
      .update(userSettings)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(userSettings.userId, req.userId))
      .returning();

    if (!updated) {
      throw new NotFoundError('Settings not found');
    }

    res.json(toUserSettingsDto(updated));
  }),
);
