'use client';

import { PlusIcon, TrashIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui';

export interface VariantRow {
  id?: string; // existing variant id
  name: string;
  sku: string;
  costPrice: string;
  sellingPrice: string;
  quantity: string;
  minQuantity: string;
}

interface VariantEditorProps {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
  isEditing: boolean; // when editing existing product, quantity is read-only
}

export function VariantEditor({ variants, onChange, isEditing }: VariantEditorProps) {
  const addRow = () => {
    onChange([...variants, { name: '', sku: '', costPrice: '0', sellingPrice: '0', quantity: '0', minQuantity: '0' }]);
  };

  const removeRow = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof VariantRow, value: string) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const totalQty = variants.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300">
          Variants
          {variants.length > 0 && (
            <span className="ml-2 text-xs text-zinc-500">
              Total qty: <span className="text-white font-medium">{totalQty}</span>
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add Variant
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No variants. Click &quot;Add Variant&quot; to create one.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {variants.map((v, i) => (
            <div key={v.id || `new-${i}`} className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    label="Name *"
                    value={v.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                    placeholder="e.g., Red - Large"
                    required
                  />
                  <Input
                    label="SKU"
                    value={v.sku}
                    onChange={(e) => updateRow(i, 'sku', e.target.value)}
                    placeholder="Optional SKU"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="mt-6 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  label="Cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.costPrice}
                  onChange={(e) => updateRow(i, 'costPrice', e.target.value)}
                />
                <Input
                  label="Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.sellingPrice}
                  onChange={(e) => updateRow(i, 'sellingPrice', e.target.value)}
                />
                <Input
                  label="Qty"
                  type="number"
                  min="0"
                  value={v.quantity}
                  onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                  disabled={isEditing && !!v.id}
                />
                <Input
                  label="Min Qty"
                  type="number"
                  min="0"
                  value={v.minQuantity}
                  onChange={(e) => updateRow(i, 'minQuantity', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
