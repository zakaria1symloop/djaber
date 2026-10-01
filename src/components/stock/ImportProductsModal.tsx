'use client';

import { useRef, useState } from 'react';
import { Modal } from '@/components/stock/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/contexts/LanguageContext';
import { translateBackendError } from '@/lib/i18n';
import { importProducts, type ProductImportReport } from '@/lib/user-stock-api';

const ACCEPT = '.xlsx,.xlsm,.xls,.csv';
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called once rows were actually created, so the caller can refresh its list. */
  onImported: () => void;
}

/**
 * Bulk product import. The backend validates the whole sheet before writing
 * anything and answers a per-row report, so the only job here is to hand over
 * the file and render that report — a file where every row is invalid comes
 * back as a success with `imported: 0`, not as an error.
 */
export function ImportProductsModal({ isOpen, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ProductImportReport | null>(null);

  const reset = () => {
    setFile(null);
    setReport(null);
    setBusy(false);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const accept = (picked: File | undefined | null) => {
    if (!picked) return;
    const ext = picked.name.slice(picked.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPT.split(',').includes(ext)) {
      toast.error(t('stock.import.badType'));
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error(t('stock.import.tooBig'));
      return;
    }
    setReport(null);
    setFile(picked);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await importProducts(file);
      setReport(result);
      if (result.imported > 0) {
        toast.success(t('stock.import.done').replace('{n}', String(result.imported)));
        onImported();
      } else {
        toast.error(t('stock.import.noneImported'));
      }
    } catch (err) {
      // The backend message is already translated; show it as-is.
      toast.error(translateBackendError(err instanceof Error ? err : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('stock.import.title')} size="xl">
      <div className="space-y-5">
        <p className="text-sm text-zinc-400">{t('stock.import.intro')}</p>

        {/* Expected columns */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {t('stock.import.columns.title')}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            <li>
              <span className="text-white">{t('stock.import.columns.required')}</span>{' '}
              {t('stock.import.columns.requiredList')}
            </li>
            <li>
              <span className="text-white">{t('stock.import.columns.optional')}</span>{' '}
              {t('stock.import.columns.optionalList')}
            </li>
          </ul>
          <p className="mt-2 text-xs text-zinc-500">{t('stock.import.columns.hint')}</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-white/40 bg-white/[0.06]' : 'border-white/15 bg-white/[0.02]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="truncate text-white">{file.name}</span>
              <span className="text-xs text-zinc-500">{Math.ceil(file.size / 1024)} KB</span>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="text-xs text-zinc-400 underline hover:text-white disabled:opacity-50"
              >
                {t('stock.import.changeFile')}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-300">{t('stock.import.drop')}</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
              >
                {t('stock.import.choose')}
              </button>
              <p className="mt-3 text-xs text-zinc-500">{t('stock.import.limits')}</p>
            </>
          )}
        </div>

        {/* Per-row report */}
        {report && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: t('stock.import.stat.total'), value: report.total },
                { label: t('stock.import.stat.imported'), value: report.imported },
                { label: t('stock.import.stat.skipped'), value: report.skipped },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xl font-semibold text-white">{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {report.errors.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="text-zinc-500">
                      <th className="px-3 py-2 text-start font-medium">{t('stock.import.col.row')}</th>
                      <th className="px-3 py-2 text-start font-medium">{t('stock.import.col.field')}</th>
                      <th className="px-3 py-2 text-start font-medium">{t('stock.import.col.problem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.map((e, i) => (
                      <tr key={`${e.row}-${e.field}-${i}`} className="border-t border-white/5">
                        <td className="px-3 py-2 text-zinc-400">{e.row}</td>
                        <td className="px-3 py-2 text-zinc-400">{e.field}</td>
                        <td className="px-3 py-2 text-zinc-300">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
          >
            {report ? t('stock.import.closeDone') : t('stock.import.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!file || busy}
            className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t('stock.import.importing') : t('stock.import.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
