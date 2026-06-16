import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SleepLog } from '@glob/shared';
import { api } from './client';

export interface SleepLogInput {
  logDate: string;
  hoursSlept: number;
  hoursInBed?: number | null;
  qualityRating?: number | null;
  notes?: string | null;
}

export function useSleepLog(date: string) {
  return useQuery({
    queryKey: ['sleep', 'logs', date],
    queryFn: () => api.get<SleepLog | null>(`/sleep/logs?date=${date}`),
  });
}

export function useSleepHistory(from: string, to: string) {
  return useQuery({
    queryKey: ['sleep', 'logs', 'range', from, to],
    queryFn: () => api.get<SleepLog[]>(`/sleep/logs?from=${from}&to=${to}`),
  });
}

export function useSetSleepLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SleepLogInput) => api.put<SleepLog>('/sleep/logs', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
    },
  });
}

export function useDeleteSleepLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.delete<void>(`/sleep/logs/${date}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
    },
  });
}
