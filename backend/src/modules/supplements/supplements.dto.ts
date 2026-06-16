import type { Supplement, SupplementLog } from '@glob/shared';
import type { supplementLogs, supplements } from '../../db/schema/index';

type SupplementRow = typeof supplements.$inferSelect;
type SupplementLogRow = typeof supplementLogs.$inferSelect;

export function toSupplementDto(row: SupplementRow): Supplement {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function toSupplementLogDto(supplementId: string, logDate: string, row?: SupplementLogRow): SupplementLog {
  return {
    supplementId,
    logDate,
    taken: row?.taken ?? false,
  };
}
