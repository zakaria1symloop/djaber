'use client';

import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  emptyIcon,
  emptyTitle = 'No data',
  emptyDescription = 'No items to display',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
        {emptyIcon && <div className="text-zinc-600 mb-4 flex justify-center">{emptyIcon}</div>}
        <h3 className="text-lg font-medium text-zinc-300 mb-1">{emptyTitle}</h3>
        <p className="text-sm text-zinc-500">{emptyDescription}</p>
      </div>
    );
  }

  const alignClass = (align?: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-xs font-medium text-zinc-400 px-4 py-3 ${alignClass(col.align)}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item[keyField]} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${alignClass(col.align)}`}>
                    {col.render ? col.render(item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
