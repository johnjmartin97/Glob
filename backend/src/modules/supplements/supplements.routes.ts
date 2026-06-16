import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { supplementLogs, supplements } from '../../db/schema/index';
import { requireAuth } from '../../middleware/requireAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';
import { toSupplementDto, toSupplementLogDto } from './supplements.dto';

export const supplementsRouter = Router();

supplementsRouter.use(requireAuth);

const createSupplementSchema = z.object({
  name: z.string().min(1).max(100),
  dosage: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updateSupplementSchema = createSupplementSchema.partial();

const logSchema = z.object({
  supplementId: z.string().uuid(),
  logDate: z.string().date(),
  taken: z.boolean(),
});

supplementsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db.query.supplements.findMany({
      where: eq(supplements.userId, req.userId),
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.name)],
    });
    res.json(rows.map(toSupplementDto));
  }),
);

supplementsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSupplementSchema.parse(req.body);

    const [created] = await db
      .insert(supplements)
      .values({
        userId: req.userId,
        name: body.name,
        dosage: body.dosage ?? null,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      })
      .returning();

    res.status(201).json(toSupplementDto(created!));
  }),
);

supplementsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateSupplementSchema.parse(req.body);

    const existing = await db.query.supplements.findFirst({
      where: eq(supplements.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Supplement not found');
    }

    const [updated] = await db
      .update(supplements)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(supplements.id, existing.id))
      .returning();

    res.json(toSupplementDto(updated!));
  }),
);

supplementsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.query.supplements.findFirst({
      where: eq(supplements.id, req.params.id!),
    });
    if (!existing || existing.userId !== req.userId) {
      throw new NotFoundError('Supplement not found');
    }

    await db.delete(supplements).where(eq(supplements.id, existing.id));
    res.status(204).end();
  }),
);

supplementsRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);

    const userSupplements = await db.query.supplements.findMany({
      where: eq(supplements.userId, req.userId),
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.name)],
    });

    const supplementIds = userSupplements.map((s) => s.id);
    const logRows = supplementIds.length
      ? await db.query.supplementLogs.findMany({
          where: and(inArray(supplementLogs.supplementId, supplementIds), eq(supplementLogs.logDate, date)),
        })
      : [];
    const logBySupplementId = new Map(logRows.map((l) => [l.supplementId, l]));

    res.json({
      date,
      supplements: userSupplements.map(toSupplementDto),
      logs: userSupplements.map((s) =>
        toSupplementLogDto(s.id, date, logBySupplementId.get(s.id)),
      ),
    });
  }),
);

supplementsRouter.put(
  '/logs',
  asyncHandler(async (req, res) => {
    const body = logSchema.parse(req.body);

    const supplement = await db.query.supplements.findFirst({
      where: eq(supplements.id, body.supplementId),
    });
    if (!supplement || supplement.userId !== req.userId) {
      throw new NotFoundError('Supplement not found');
    }

    const [row] = await db
      .insert(supplementLogs)
      .values({ supplementId: body.supplementId, logDate: body.logDate, taken: body.taken })
      .onConflictDoUpdate({
        target: [supplementLogs.supplementId, supplementLogs.logDate],
        set: { taken: body.taken, updatedAt: new Date() },
      })
      .returning();

    res.json(toSupplementLogDto(body.supplementId, body.logDate, row));
  }),
);
