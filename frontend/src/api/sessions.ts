import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkoutSession } from '@glob/shared';
import { api } from './client';

export interface SessionSummary {
  id: string;
  templateId: string | null;
  name: string;
  startedAt: string;
  completedAt: string | null;
  exerciseCount: number;
}

export interface SetUpdateInput {
  prescribedReps?: number | null;
  prescribedLoadKg?: number | null;
  prescribedRpe?: number | null;
  prescribedVelocityMps?: number | null;
  actualWeightKg?: number | null;
  actualReps?: number | null;
  actualRpe?: number | null;
  actualVelocityMps?: number | null;
  completed?: boolean;
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<SessionSummary[]>('/sessions'),
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => api.get<WorkoutSession>(`/sessions/${id}`),
    enabled: !!id,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { templateId?: string; name?: string }) =>
      api.post<WorkoutSession>('/sessions', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useUpdateSession(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; notes?: string | null; completedAt?: string | null }) =>
      api.patch<WorkoutSession>(`/sessions/${id}`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['sessions', id], data);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useUpdateSet(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ setId, input }: { setId: string; input: SetUpdateInput }) =>
      api.patch<WorkoutSession>(`/sessions/sets/${setId}`, input),
    onMutate: async ({ setId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['sessions', sessionId] });
      const previous = queryClient.getQueryData<WorkoutSession>(['sessions', sessionId]);
      if (previous) {
        queryClient.setQueryData<WorkoutSession>(['sessions', sessionId], {
          ...previous,
          exercises: previous.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((set) => (set.id === setId ? { ...set, ...input } : set)),
          })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['sessions', sessionId], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['sessions', sessionId], data);
    },
  });
}

export function useAddSessionExercise(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { exerciseId: string; notes?: string | null }) =>
      api.post<WorkoutSession>(`/sessions/${sessionId}/exercises`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['sessions', sessionId], data);
    },
  });
}

export function useDeleteSessionExercise(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) =>
      api.delete<void>(`/sessions/${sessionId}/exercises/${exerciseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useDeleteSessionSet(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (setId: string) => api.delete<WorkoutSession>(`/sessions/sets/${setId}`),
    onSuccess: (data) => {
      queryClient.setQueryData(['sessions', sessionId], data);
    },
  });
}

export function useAddSessionSet(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      exerciseId,
      input,
    }: {
      exerciseId: string;
      input: { setType?: 'warmup' | 'working'; prescribedReps?: number | null; prescribedLoadKg?: number | null };
    }) => api.post<WorkoutSession>(`/sessions/${sessionId}/exercises/${exerciseId}/sets`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['sessions', sessionId], data);
    },
  });
}
