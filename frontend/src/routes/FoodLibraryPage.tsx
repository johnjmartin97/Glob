import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { fetchBarcodeFood, useCreateFoodItem, useDeleteFoodItem, useExternalFoodSearch, useFoodItems } from '../api/nutrition';
import { ApiError } from '../api/client';
import type { ExternalFoodResult } from '@glob/shared';
import { BarcodeScanner } from '../components/BarcodeScanner';

const emptyForm = {
  name: '',
  brand: '',
  servingSize: '',
  servingUnit: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
};

export function FoodLibraryPage() {
  const { data: foods, isLoading } = useFoodItems();
  const createFood = useCreateFoodItem();
  const deleteFood = useDeleteFoodItem();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [extQuery, setExtQuery] = useState('');
  const [importedKey, setImportedKey] = useState<string | null>(null);
  const extSearch = useExternalFoodSearch(extQuery);

  const [scanning, setScanning] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<ExternalFoodResult | null | 'not-found'>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFood.mutateAsync({
        name: form.name,
        brand: form.brand || null,
        servingSize: Number(form.servingSize),
        servingUnit: form.servingUnit,
        calories: Number(form.calories),
        proteinG: Number(form.proteinG || 0),
        carbsG: Number(form.carbsG || 0),
        fatG: Number(form.fatG || 0),
      });
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create food item');
    }
  }

  async function handleBarcodeScan(upc: string) {
    setScanning(false);
    setBarcodeResult(null);
    setBarcodeLoading(true);
    try {
      const result = await fetchBarcodeFood(upc);
      setBarcodeResult(result ?? 'not-found');
    } catch {
      setError('Could not look up barcode. Try again.');
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function handleImport(result: ExternalFoodResult) {
    setError(null);
    try {
      await createFood.mutateAsync(result);
      const key = `${result.name}|${result.brand ?? ''}`;
      setImportedKey(key);
      setTimeout(() => setImportedKey(null), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to import food item');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteFood.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete food item');
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Food Library</h1>
        <Link to="/nutrition" className="text-sm text-emerald-400">
          Back
        </Link>
      </div>

      {scanning && (
        <BarcodeScanner onDetected={handleBarcodeScan} onClose={() => setScanning(false)} />
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search food database…"
            value={extQuery}
            onChange={(e) => { setExtQuery(e.target.value); setBarcodeResult(null); }}
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="shrink-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300"
            aria-label="Scan barcode"
          >
            &#x1F4F7;
          </button>
        </div>

        {barcodeLoading && <p className="text-sm text-slate-400">Looking up barcode…</p>}

        {barcodeResult === 'not-found' && (
          <p className="text-sm text-slate-400">No product found for this barcode.</p>
        )}

        {barcodeResult && barcodeResult !== 'not-found' && (() => {
          const key = `${barcodeResult.name}|${barcodeResult.brand ?? ''}`;
          return (
            <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate font-medium">
                  {barcodeResult.name}
                  {barcodeResult.brand && <span className="text-slate-400"> · {barcodeResult.brand}</span>}
                </p>
                <p className="text-sm text-slate-400">
                  {barcodeResult.servingSize}{barcodeResult.servingUnit} · {barcodeResult.calories} kcal · P{barcodeResult.proteinG} C{barcodeResult.carbsG} F{barcodeResult.fatG}
                </p>
              </div>
              <div className="shrink-0">
                {importedKey === key ? (
                  <span className="text-sm text-emerald-400">Imported!</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleImport(barcodeResult as ExternalFoodResult)}
                    disabled={createFood.isPending}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Import
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {extSearch.isFetching && (
          <p className="text-sm text-slate-400">Searching…</p>
        )}

        {extSearch.isError && (
          <p className="text-sm text-red-400">Could not reach food database. Try again.</p>
        )}

        {extSearch.data && extSearch.data.length === 0 && extQuery.length >= 2 && !extSearch.isFetching && (
          <p className="text-sm text-slate-400">No results found.</p>
        )}

        {extSearch.data && extSearch.data.length > 0 && (
          <ul className="space-y-2">
            {extSearch.data.map((result) => {
              const key = `${result.name}|${result.brand ?? ''}`;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate font-medium">
                      {result.name}
                      {result.brand && <span className="text-slate-400"> · {result.brand}</span>}
                    </p>
                    <p className="text-sm text-slate-400">
                      {result.servingSize}{result.servingUnit} · {result.calories} kcal · P{result.proteinG} C{result.carbsG} F{result.fatG}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {importedKey === key ? (
                      <span className="text-sm text-emerald-400">Imported!</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImport(result)}
                        disabled={createFood.isPending}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Import
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm font-medium text-slate-200">Add food item</p>
        <input
          type="text"
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Brand (optional)"
          value={form.brand}
          onChange={(e) => update('brand', e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Serving size"
            required
            min="0"
            step="any"
            value={form.servingSize}
            onChange={(e) => update('servingSize', e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Unit (g, ml, cup…)"
            required
            value={form.servingUnit}
            onChange={(e) => update('servingUnit', e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <input
            type="number"
            placeholder="kcal"
            required
            min="0"
            step="any"
            value={form.calories}
            onChange={(e) => update('calories', e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="number"
            placeholder="Protein"
            min="0"
            step="any"
            value={form.proteinG}
            onChange={(e) => update('proteinG', e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="number"
            placeholder="Carbs"
            min="0"
            step="any"
            value={form.carbsG}
            onChange={(e) => update('carbsG', e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="number"
            placeholder="Fat"
            min="0"
            step="any"
            value={form.fatG}
            onChange={(e) => update('fatG', e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={createFood.isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {createFood.isPending ? 'Adding…' : 'Add food'}
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      <ul className="space-y-2">
        {foods?.map((food) => (
          <li
            key={food.id}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
          >
            <div>
              <p className="font-medium">
                {food.name}
                {food.brand ? <span className="text-slate-400"> · {food.brand}</span> : null}
              </p>
              <p className="text-sm text-slate-400">
                {food.servingSize}
                {food.servingUnit} · {food.calories} kcal · P{food.proteinG} C{food.carbsG} F
                {food.fatG}
              </p>
            </div>
            <button onClick={() => handleDelete(food.id)} className="text-sm text-red-400">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
