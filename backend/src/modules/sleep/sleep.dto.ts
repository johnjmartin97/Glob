import type { SleepLog } from '@glob/shared';
import type { sleepLogs } from '../../db/schema/index';

type SleepLogRow = typeof sleepLogs.$inferSelect;

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function toSleepLogDto(row: SleepLogRow): SleepLog {
  return {
    logDate: row.logDate,
    hoursSlept: Number(row.hoursSlept),
    hoursInBed: toNumber(row.hoursInBed),
    qualityRating: row.qualityRating,
    notes: row.notes,
  };
}
