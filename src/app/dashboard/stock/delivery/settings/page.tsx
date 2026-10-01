'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { Modal, Select } from '@/components/stock';
import { WilayaSelector } from '@/components/stock/WilayaSelector';
import {
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  EditIcon,
  CheckCircleIcon,
  SettingsIcon,
} from '@/components/ui/icons';
import {
  getDeliveryProviders,
  getAvailableProviders,
  addDeliveryProvider,
  updateDeliveryProvider,
  deleteDeliveryProvider,
  testDeliveryCredentials,
  getWilayas,
  type DeliveryProvider,
  type AvailableProvider,
  type Wilaya,
} from '@/lib/delivery-api';
import { useTranslation } from '@/contexts/LanguageContext';

export default function DeliverySettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<DeliveryProvider[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [wilayas, setWilayasData] = useState<Wilaya[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProvider, setEditProvider] = useState<DeliveryProvider | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formProvider, setFormProvider] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formCredentials, setFormCredentials] = useState<Record<string, string>>({});
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSenderName, setFormSenderName] = useState('');
  const [formSenderPhone, setFormSenderPhone] = useState('');
  const [formSenderAddress, setFormSenderAddress] = useState('');
  const [formSenderWilaya, setFormSenderWilaya] = useState<number | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [provRes, availRes, wilRes] = await Promise.all([
        getDeliveryProviders(),
        getAvailableProviders().catch(() => ({ providers: [] })),
        getWilayas(),
      ]);
      setProviders(provRes.providers);
      setAvailableProviders(availRes.providers);
      setWilayasData(wilRes.wilayas);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stk.ops.dset.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedSchema = availableProviders.find(p => p.id === formProvider);

  const resetForm = () => {
    setFormProvider('');
    setFormDisplayName('');
    setFormCredentials({});
    setFormIsDefault(false);
    setFormSenderName('');
    setFormSenderPhone('');
    setFormSenderAddress('');
    setFormSenderWilaya(null);
    setTestResult(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (p: DeliveryProvider) => {
    setEditProvider(p);
    setFormProvider(p.provider);
    setFormDisplayName(p.displayName);
    setFormCredentials({});
    setFormIsDefault(p.isDefault);
    setFormSenderName(p.senderName || '');
    setFormSenderPhone(p.senderPhone || '');
    setFormSenderAddress(p.senderAddress || '');
    setFormSenderWilaya(p.senderWilayaId);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!formProvider || Object.keys(formCredentials).length === 0) {
      setTestResult({ success: false, message: t('stk.ops.dset.fillCredentials') });
      return;
    }
    try {
      setTesting(true);
      setTestResult(null);
      const result = await testDeliveryCredentials(formProvider, formCredentials);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : t('stk.ops.dset.testFailed') });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setFormSaving(true);
      if (editProvider) {
        const data: any = {
          displayName: formDisplayName || formProvider,
          isDefault: formIsDefault,
          senderName: formSenderName,
          senderPhone: formSenderPhone,
          senderAddress: formSenderAddress,
          senderWilayaId: formSenderWilaya,
        };
        if (Object.keys(formCredentials).length > 0) {
          data.credentials = formCredentials;
        }
        await updateDeliveryProvider(editProvider.id, data);
        setEditProvider(null);
      } else {
        await addDeliveryProvider({
          provider: formProvider,
          displayName: formDisplayName || selectedSchema?.name || formProvider,
          credentials: formCredentials,
          isDefault: formIsDefault,
          senderName: formSenderName,
          senderPhone: formSenderPhone,
          senderAddress: formSenderAddress,
          senderWilayaId: formSenderWilaya || undefined,
        });
        setShowAddModal(false);
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stk.ops.dset.saveFailed'));
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDeliveryProvider(id);
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stk.ops.dset.deleteFailed'));
    }
  };

  const providerLabel = (providerId: string) => {
    return availableProviders.find(p => p.id === providerId)?.name || providerId;
  };

  // Shared form fields
  const renderForm = () => (
    <div className="space-y-4">
      {!editProvider && (
        <Select
          label={t('stk.ops.dset.provider')}
          value={formProvider}
          onChange={e => {
            setFormProvider(e.target.value);
            setFormCredentials({});
            setTestResult(null);
          }}
        >
          <option value="">{t('stk.ops.dset.selectProvider')}</option>
          {availableProviders
            .filter(ap => !providers.find(p => p.provider === ap.id))
            .map(ap => (
              <option key={ap.id} value={ap.id}>{ap.name}</option>
            ))}
        </Select>
      )}

      {editProvider && (
        <div className="text-sm text-zinc-400">
          {t('stk.ops.dset.providerLine')} <span className="text-white font-medium">{providerLabel(editProvider.provider)}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">{t('stk.ops.dset.displayName')}</label>
        <input
          type="text"
          value={formDisplayName}
          onChange={e => setFormDisplayName(e.target.value)}
          placeholder={selectedSchema?.name || t('stk.ops.dset.displayNamePlaceholder')}
          className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white
            focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
            placeholder:text-zinc-500"
        />
      </div>

      {/* Dynamic credential fields */}
      {selectedSchema && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-zinc-300">{t('stk.ops.dset.credentials')}</h4>
          {selectedSchema.credentials.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{field.label}</label>
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                value={formCredentials[field.key] || ''}
                onChange={e => setFormCredentials({ ...formCredentials, [field.key]: e.target.value })}
                placeholder={editProvider ? t('stk.ops.dset.unchangedPlaceholder') : t('stk.ops.dset.enterField').replace('{field}', field.label)}
                className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white
                  focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
                  placeholder:text-zinc-500"
              />
            </div>
          ))}

          <Button
            onClick={handleTest}
            disabled={testing || Object.values(formCredentials).some(v => !v)}
            className="text-sm"
            variant="secondary"
          >
            {testing ? t('stk.ops.dset.testing') : t('stk.ops.dset.testCredentials')}
          </Button>

          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              testResult.success
                ? 'bg-white/[0.03] text-zinc-300 border border-white/10'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* Sender info */}
      <div className="border-t border-white/10 pt-4 space-y-3">
        <h4 className="text-sm font-medium text-zinc-300">{t('stk.ops.dset.senderInfo')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">{t('stk.ops.dset.senderName')}</label>
            <input
              type="text"
              value={formSenderName}
              onChange={e => setFormSenderName(e.target.value)}
              className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white
                focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
                placeholder:text-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">{t('stk.ops.dset.senderPhone')}</label>
            <input
              type="text"
              value={formSenderPhone}
              onChange={e => setFormSenderPhone(e.target.value)}
              className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white
                focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
                placeholder:text-zinc-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">{t('stk.ops.dset.senderAddress')}</label>
          <input
            type="text"
            value={formSenderAddress}
            onChange={e => setFormSenderAddress(e.target.value)}
            className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white
              focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
              placeholder:text-zinc-500"
          />
        </div>
        <WilayaSelector
          wilayas={wilayas}
          value={formSenderWilaya}
          onChange={setFormSenderWilaya}
          label={t('stk.ops.dset.senderWilaya')}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={formIsDefault}
          onChange={e => setFormIsDefault(e.target.checked)}
          className="rounded border-white/20 bg-black"
        />
        {t('stk.ops.dset.setDefault')}
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          onClick={() => {
            setShowAddModal(false);
            setEditProvider(null);
            resetForm();
          }}
        >
          {t('stk.ops.c.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={formSaving || (!editProvider && (!formProvider || Object.keys(formCredentials).length === 0))}
        >
          {formSaving ? t('stk.ops.c.saving') : editProvider ? t('stk.ops.c.update') : t('stk.ops.dset.addProvider')}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshIcon className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{t('stk.ops.dset.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('stk.ops.dset.subtitle')}</p>
        </div>
        <Button onClick={handleAdd}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t('stk.ops.dset.addProvider')}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ms-2 underline">{t('stk.ops.c.dismiss')}</button>
        </div>
      )}

      {/* Provider Cards */}
      {providers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <SettingsIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">{t('stk.ops.dset.emptyTitle')}</h3>
          <p className="text-zinc-400 text-sm mb-6">{t('stk.ops.dset.emptyHint')}</p>
          <Button onClick={handleAdd}>
            <PlusIcon className="w-4 h-4 mr-2" />
            {t('stk.ops.dset.addProvider')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map(p => (
            <div
              key={p.id}
              className={`bg-zinc-900/50 border rounded-xl p-5 ${
                p.isActive ? 'border-white/10' : 'border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{p.displayName}</h3>
                  {p.isDefault && (
                    <span className="text-xs bg-white/[0.03] text-zinc-300 border border-white/10 px-2 py-0.5 rounded-full">
                      {t('stk.ops.dset.default')}
                    </span>
                  )}
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${p.isActive ? 'bg-white' : 'border border-zinc-600'}`} />
              </div>

              <div className="text-sm text-zinc-400 space-y-1 mb-4">
                <div>{t('stk.ops.dset.providerLine')} <span className="text-zinc-300">{providerLabel(p.provider)}</span></div>
                {p.senderName && <div>{t('stk.ops.dset.senderLine')} <span className="text-zinc-300">{p.senderName}</span></div>}
                {p.senderPhone && <div>{t('stk.ops.dset.phoneLine')} <span className="text-zinc-300">{p.senderPhone}</span></div>}
                {p.senderWilayaId && (
                  <div>
                    {t('stk.ops.dset.wilayaLine')}{' '}
                    <span className="text-zinc-300">
                      {wilayas.find(w => w.id === p.senderWilayaId)?.nameFr || p.senderWilayaId}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" className="text-xs flex-1" onClick={() => handleEdit(p)}>
                  <EditIcon className="w-3.5 h-3.5 mr-1" />
                  {t('stk.ops.c.edit')}
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs text-zinc-400 hover:text-white"
                  onClick={() => setDeleteConfirm(p.id)}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title={t('stk.ops.dset.addTitle')} size="lg">
        {renderForm()}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editProvider} onClose={() => { setEditProvider(null); resetForm(); }} title={t('stk.ops.dset.editTitle')} size="lg">
        {renderForm()}
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={t('stk.ops.dset.deleteTitle')} size="sm">
        <p className="text-zinc-400 mb-6">{t('stk.ops.dset.deleteBody')}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>{t('stk.ops.c.cancel')}</Button>
          <Button
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            {t('stk.ops.c.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
