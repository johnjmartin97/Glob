import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Exercise, ExerciseCategory, WeightUnit } from '@glob/shared';
import { api } from './client';

export const EXERCISE_CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'squat', label: 'Squat' },
  { value: 'bench', label: 'Bench' },
  { value: 'deadlift', label: 'Deadlift' },
  { value: 'overhead_press', label: 'Overhead Press' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
];

export function useExercises(category?: ExerciseCategory) {
  return useQuery({
    queryKey: ['exercises', category ?? 'all'],
    queryFn: () =>
      api.get<Exercise[]>(`/exercises${category ? `?category=${category}` : ''}`),
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; category: ExerciseCategory; weightUnit?: WeightUnit }) =>
      api.post<Exercise>('/exercises', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; weightUnit?: WeightUnit; name?: string; category?: ExerciseCategory }) =>
      api.patch<Exercise>(`/exercises/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

export interface ExerciseSettingsInput {
  weightUnit?: WeightUnit;
  logRpe?: boolean;
  logVelocity?: boolean;
}

export function useUpdateExerciseSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & ExerciseSettingsInput) =>
      api.put<Exercise>(`/exercises/${id}/settings`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/exercises/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}
