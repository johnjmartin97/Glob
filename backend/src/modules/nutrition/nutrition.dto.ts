import type { FoodItem, FoodLogEntry, MealType, NutritionTarget } from '@glob/shared';
import type { foodItems, foodLogEntries, nutritionTargets } from '../../db/schema/index';

type NutritionTargetRow = typeof nutritionTargets.$inferSelect;
type FoodItemRow = typeof foodItems.$inferSelect;
type FoodLogEntryRow = typeof foodLogEntries.$inferSelect;

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function toNutritionTargetDto(row: NutritionTargetRow): NutritionTarget {
  return {
    effectiveDate: row.effectiveDate,
    caloriesTarget: row.caloriesTarget,
    proteinGTarget: toNumber(row.proteinGTarget),
    carbsGTarget: toNumber(row.carbsGTarget),
    fatGTarget: toNumber(row.fatGTarget),
  };
}

export function toFoodItemDto(row: FoodItemRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    servingSize: Number(row.servingSize),
    servingUnit: row.servingUnit,
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
  };
}

export function toFoodLogEntryDto(
  row: FoodLogEntryRow,
  foodItem?: FoodItemRow,
): FoodLogEntry {
  return {
    id: row.id,
    foodItemId: row.foodItemId,
    foodItem: foodItem ? toFoodItemDto(foodItem) : undefined,
    logDate: row.logDate,
    mealType: row.mealType as MealType,
    servings: Number(row.servings),
    loggedAt: row.loggedAt.toISOString(),
  };
}
