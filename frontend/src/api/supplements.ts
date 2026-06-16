import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Supplement, SupplementLog } from '@glob/shared';
import { api } from './client';

export interface SupplementInput {
  name: string;
  dosage?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface DailySupplementChecklist {
  date: string;
  supplements: Supplement[];
  logs: SupplementLog[];
}

export function useSupplements() {
  return useQuery({
    queryKey: ['supplements'],
    queryFn: () => api.get<Supplement[]>('/supplements'),
  });
}

export function useCreateSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplementInput) => api.post<Supplement>('/supplements', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements'] });
    },
  });
}

export function useUpdateSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SupplementInput> }) =>
      api.patch<Supplement>(`/supplements/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements'] });
    },
  });
}

export function useDeleteSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/supplements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements'] });
      queryClient.invalidateQueries({ queryKey: ['supplements', 'logs'] });
    },
  });
}

export function useSupplementChecklist(date: string) {
  return useQuery({
    queryKey: ['supplements', 'logs', date],
    queryFn: () => api.get<DailySupplementChecklist>(`/supplements/logs?date=${date}`),
  });
}

export function useSetSupplementLog(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ supplementId, taken }: { supplementId: string; taken: boolean }) =>
      api.put<SupplementLog>('/supplements/logs', { supplementId, logDate: date, taken }),
    onMutate: async ({ supplementId, taken }) => {
      await queryClient.cancelQueries({ queryKey: ['supplements', 'logs', date] });
      const previous = queryClient.getQueryData<DailySupplementChecklist>(['supplements', 'logs', date]);
      if (previous) {
        queryClient.setQueryData<DailySupplementChecklist>(['supplements', 'logs', date], {
          ...previous,
          logs: previous.logs.map((log) =>
            log.supplementId === supplementId ? { ...log, taken } : log,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['supplements', 'logs', date], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements', 'logs', date] });
    },
  });
}
