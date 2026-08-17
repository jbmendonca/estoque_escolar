'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModuleType } from '@/modules/shared/enums';

interface CategoryOption {
  id: string;
  name: string;
  module: ModuleType;
}
interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
}

const MODULE_LABEL: Record<ModuleType, string> = {
  [ModuleType.FOOD]: 'Merenda Escolar',
  [ModuleType.SCHOOL_MATERIAL]: 'Material Escolar',
};

/**
 * Formulário único de cadastro de itens, usado tanto para Merenda quanto para
 * Material Escolar. O módulo selecionado filtra as categorias disponíveis.
 */
export function ItemForm({
  categories,
  units,
  initialModule,
}: {
  categories: CategoryOption[];
  units: UnitOption[];
  initialModule: ModuleType;
}) {
  const router = useRouter();
  const [module, setModule] = useState<ModuleType>(initialModule);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitOfMeasureId, setUnitOfMeasureId] = useState('');
  const [minStock, setMinStock] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const moduleCategories = useMemo(
    () => categories.filter((c) => c.module === module),
    [categories, module],
  );

  function onModuleChange(next: ModuleType) {
    setModule(next);
    setCategoryId(''); // categoria pertence a um módulo; zera ao trocar
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!categoryId) {
      setMessage({ kind: 'err', text: 'Selecione a categoria.' });
      return;
    }
    if (!unitOfMeasureId) {
      setMessage({ kind: 'err', text: 'Selecione a unidade de medida.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          name: name.trim(),
          categoryId,
          unitOfMeasureId,
          minStock: minStock ? Number(minStock) : undefined,
          brand: brand.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: 'err', text: body?.error?.message ?? 'Não foi possível cadastrar o item.' });
        return;
      }
      setMessage({
        kind: 'ok',
        text: `Item "${body.name}" cadastrado com o código ${body.code}.`,
      });
      // Mantém o módulo (cadastro em lote), limpa o resto.
      setName('');
      setCategoryId('');
      setUnitOfMeasureId('');
      setMinStock('');
      setBrand('');
      setDescription('');
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Tipo de item</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {[ModuleType.FOOD, ModuleType.SCHOOL_MATERIAL].map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                module === m
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="module"
                value={m}
                checked={module === m}
                onChange={() => onModuleChange(m)}
              />
              {MODULE_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="item-name" className="block text-sm font-medium text-slate-700">
          Nome do item
        </label>
        <input
          id="item-name"
          required
          maxLength={150}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Arroz branco tipo 1"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="item-category" className="block text-sm font-medium text-slate-700">
            Categoria
          </label>
          <select
            id="item-category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione…</option>
            {moduleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {moduleCategories.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Nenhuma categoria cadastrada para este tipo.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="item-unit" className="block text-sm font-medium text-slate-700">
            Unidade de medida
          </label>
          <select
            id="item-unit"
            required
            value={unitOfMeasureId}
            onChange={(e) => setUnitOfMeasureId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.abbreviation})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="item-min" className="block text-sm font-medium text-slate-700">
            Estoque mínimo <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            id="item-min"
            type="number"
            min="0"
            step="0.001"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Usado nos alertas de estoque baixo e na sugestão de compra.
          </p>
        </div>
        <div>
          <label htmlFor="item-brand" className="block text-sm font-medium text-slate-700">
            Marca <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            id="item-brand"
            maxLength={100}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="item-desc" className="block text-sm font-medium text-slate-700">
          Descrição <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          id="item-desc"
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {message && (
        <p
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm ${
            message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Cadastrar item'}
        </button>
      </div>
    </form>
  );
}
