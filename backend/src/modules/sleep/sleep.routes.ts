import { Router } from 'express';
import { z } from 'zod';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { sleepLogs } from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';
import { toSleepLogDto } from './sleep.dto';

export const sleepRouter = Router();

sleepRouter.use(requireAuth);

function toNumericString(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

const logSchema = z.object({
  logDate: z.string().date(),
  hoursSlept: z.number().min(0).max(24),
  hoursInBed: z.number().min(0).max(24).nullable().optional(),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

sleepRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const { date, from, to } = req.query;

    if (typeof date === 'string') {
      const row = await db.query.sleepLogs.findFirst({
        where: and(eq(sleepLogs.userId, req.userId), eq(sleepLogs.logDate, date)),
      });
      res.json(row ? toSleepLogDto(row) : null);
      return;
    }

    const conditions = [eq(sleepLogs.userId, req.userId)];
    if (typeof from === 'string') conditions.push(gte(sleepLogs.logDate, from));
    if (typeof to === 'string') conditions.push(lte(sleepLogs.logDate, to));

    const rows = await db.query.sleepLogs.findMany({
      where: and(...conditions),
      orderBy: (table, { desc }) => [desc(table.logDate)],
    });
    res.json(rows.map(toSleepLogDto));
  }),
);

sleepRouter.put(
  '/logs',
  asyncHandler(async (req, res) => {
    const body = logSchema.parse(req.body);

    const [row] = await db
      .insert(sleepLogs)
      .values({
        userId: req.userId,
        logDate: body.logDate,
        hoursSlept: String(body.hoursSlept),
        hoursInBed: toNumericString(body.hoursInBed),
        qualityRating: body.qualityRating ?? null,
        notes: body.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [sleepLogs.userId, sleepLogs.logDate],
        set: {
          hoursSlept: String(body.hoursSlept),
          hoursInBed: toNumericString(body.hoursInBed),
          qualityRating: body.qualityRating ?? null,
          notes: body.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(toSleepLogDto(row!));
  }),
);

sleepRouter.delete(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    const existing = await db.query.sleepLogs.findFirst({
      where: and(eq(sleepLogs.userId, req.userId), eq(sleepLogs.logDate, req.params.date!)),
    });
    if (!existing) {
      throw new NotFoundError('Sleep log not found');
    }

    await db.delete(sleepLogs).where(eq(sleepLogs.id, existing.id));
    res.status(204).end();
  }),
);
