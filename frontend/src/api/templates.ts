import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkoutTemplate } from '@glob/shared';
import { api } from './client';

export interface TemplateSummary {
  id: string;
  name: string;
  notes: string | null;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateExerciseInput {
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number | null;
  targetLoadKg: number | null;
  targetLoadPct: number | null;
  referenceLiftId: string | null;
  notes: string | null;
  warmupEnabled: boolean;
  warmupSetCount: number | null;
  warmupPercentages: number[] | null;
  warmupRepsPerSet: number[] | null;
  setsConfig: Array<{ loadKg: number | null; reps: number | null }> | null;
}

export interface TemplateInput {
  name: string;
  notes: string | null;
  exercises: TemplateExerciseInput[];
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<TemplateSummary[]>('/templates'),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => api.get<WorkoutTemplate>(`/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateInput) => api.post<WorkoutTemplate>('/templates', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateInput) => api.put<WorkoutTemplate>(`/templates/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
