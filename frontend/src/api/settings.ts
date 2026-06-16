import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserSettings, WeightUnit } from '@glob/shared';
import { api } from './client';

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { weightUnit?: WeightUnit; timezone?: string; theme?: UserSettings['theme'] }) =>
      api.patch<UserSettings>('/users/me/settings', input),
    onSuccess: (settings) => {
      queryClient.setQueryData<{ user: unknown; settings: UserSettings } | null>(['auth', 'me'], (prev) =>
        prev ? { ...prev, settings } : prev,
      );
    },
  });
}
