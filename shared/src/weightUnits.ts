import type { WeightUnit } from './types.js';

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : kg;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

export function formatWeight(kg: number | null, unit: WeightUnit, fractionDigits = 1): string {
  if (kg === null) return '–';
  return `${roundForDisplay(kgToDisplay(kg, unit), fractionDigits)} ${unit}`;
}

export function roundForDisplay(value: number, fractionDigits = 1): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}
