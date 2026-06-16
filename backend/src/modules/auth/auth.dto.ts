import type { User, UserSettings, WeightUnit, Theme } from '@glob/shared';
import type { users, userSettings } from '../../db/schema/index';

type UserRow = typeof users.$inferSelect;
type UserSettingsRow = typeof userSettings.$inferSelect;

export function toUserDto(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toUserSettingsDto(row: UserSettingsRow): UserSettings {
  return {
    weightUnit: row.weightUnit as WeightUnit,
    timezone: row.timezone,
    theme: row.theme as Theme,
  };
}
