import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FoodItem, FoodLogEntry, MacroTotals, MealType, NutritionTarget } from '@glob/shared';
import { api } from './client';

export interface FoodItemInput {
  name: string;
  brand?: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionTargetInput {
  caloriesTarget: number;
  proteinGTarget?: number | null;
  carbsGTarget?: number | null;
  fatGTarget?: number | null;
}

export interface DailyLog {
  date: string;
  entries: FoodLogEntry[];
  totals: MacroTotals;
  target: NutritionTarget | null;
}

export function useCurrentTarget() {
  return useQuery({
    queryKey: ['nutrition', 'targets', 'current'],
    queryFn: () => api.get<NutritionTarget | null>('/nutrition/targets/current'),
  });
}

export function useSetTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NutritionTargetInput) =>
      api.put<NutritionTarget>('/nutrition/targets/current', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'targets'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'logs'] });
    },
  });
}

export function useFoodItems(search?: string) {
  return useQuery({
    queryKey: ['nutrition', 'foods', search ?? ''],
    queryFn: () =>
      api.get<FoodItem[]>(`/nutrition/foods${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
}

export function useCreateFoodItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodItemInput) => api.post<FoodItem>('/nutrition/foods', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
    },
  });
}

export function useDeleteFoodItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/nutrition/foods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
    },
  });
}

export function useDailyLog(date: string) {
  return useQuery({
    queryKey: ['nutrition', 'logs', date],
    queryFn: () => api.get<DailyLog>(`/nutrition/logs?date=${date}`),
  });
}

export function useAddLogEntry(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { foodItemId: string; mealType: MealType; servings: number }) =>
      api.post<FoodLogEntry>('/nutrition/logs', { ...input, logDate: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'logs', date] });
    },
  });
}

export function useDeleteLogEntry(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/nutrition/logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'logs', date] });
    },
  });
}
