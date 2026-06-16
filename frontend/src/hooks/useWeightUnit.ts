import type { WeightUnit } from '@glob/shared';
import { useAuth } from '../context/AuthContext';

export function useWeightUnit(): WeightUnit {
  const { settings } = useAuth();
  return settings?.weightUnit ?? 'kg';
}
