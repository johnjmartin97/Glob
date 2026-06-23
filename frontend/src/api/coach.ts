import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CoachGoal,
  CoachingPlanDetail,
  CoachingPlanSessionStatus,
  CoachingPlanSummary,
  ReadinessSnapshot,
} from '@glob/shared';
import { api } from './client';

export interface GeneratePlanInput {
  goal: CoachGoal;
  durationWeeks: number;
  daysPerWeek: number;
}

export interface UpdatePlanSessionInput {
  status?: CoachingPlanSessionStatus;
  sessionId?: string;
}

export function useReadiness() {
  return useQuery({
    queryKey: ['coach', 'readiness'],
    queryFn: () => api.get<ReadinessSnapshot>('/coach/readiness'),
  });
}

export function useActivePlan() {
  return useQuery({
    queryKey: ['coach', 'plans', 'active'],
    queryFn: () => api.get<CoachingPlanDetail | null>('/coach/plans/active'),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['coach', 'plans'],
    queryFn: () => api.get<CoachingPlanSummary[]>('/coach/plans'),
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: ['coach', 'plans', id],
    queryFn: () => api.get<CoachingPlanDetail>(`/coach/plans/${id}`),
    enabled: !!id,
  });
}

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePlanInput) => api.post<CoachingPlanDetail>('/coach/plans', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach'] });
    },
  });
}

export function useUpdatePlanSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlanSessionInput }) =>
      api.patch<CoachingPlanDetail>(`/coach/plan-sessions/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach'] });
    },
  });
}

export function useAbandonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<CoachingPlanDetail>(`/coach/plans/${id}`, { status: 'abandoned' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach'] });
    },
  });
}
