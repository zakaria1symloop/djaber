'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { StatsCard, Modal, Select } from '@/components/stock';
import { WilayaSelector } from '@/components/stock/WilayaSelector';
import {
  TruckIcon,
  BoxIcon,
  CheckCircleIcon,
  DollarIcon,
  RefreshIcon,
  SearchIcon,
  EyeIcon,
  FileTextIcon,
  SettingsIcon,
} from '@/components/ui/icons';
import {
  getOrders,
  type Order,
} from '@/lib/user-stock-api';
import {
  getDeliveryProviders,
  getWilayas,
  sendOrderToDelivery,
  getTrackingInfo,
  getShippingLabel,
  getDeliveryRates,
  type DeliveryProvider,
  type Wilaya,
  type DeliveryRates,
} from '@/lib/delivery-api';

type DeliveryFilter = 'all' | 'not_sent' | 'sent' | 'in_transit' | 'delivered';

export default function DeliveryDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [providers, setProviders] = useState<DeliveryProvider[]>([]);
  const [wilayaList, setWilayaList] = useState<Wilaya[]>([]);
  const [filter, setFilter] = useState<DeliveryFilter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Send modal
  const [sendOrder, setSendOrder] = useState<Order | null>(null);
  const [sendProviderId, setSendProviderId] = useState('');
  const [sendWilaya, setSendWilaya] = useState<number | null>(null);
  const [sendStopdesk, setSendStopdesk] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendRates, setSendRates] = useState<DeliveryRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Track modal
  const [trackOrder, setTrackOrder] = useState<Order | null>(null);
  const [trackData, setTrackData] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { limit: 100 };
      if (filter !== 'all') {
        // Use deliveryStatus filter — since backend getOrders may not support it directly,
        // we'll filter client-side
      }
      if (search) params.search = search;

      const [ordersRes, provsRes, wilRes] = await Promise.all([
        getOrders(params),
        getDeliveryProviders().catch(() => ({ providers: [] })),
        getWilayas(),
      ]);

      let filteredOrders = ordersRes.orders;
      if (filter !== 'all') {
        filteredOrders = filteredOrders.filter(o => o.deliveryStatus === filter);
      }

      setOrders(filteredOrders);
      setTotal(filteredOrders.length);
      setProviders(provsRes.providers);
      setWilayaList(wilRes.wilayas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stats
  const stats = {
    readyToShip: orders.filter(o =>
      o.deliveryStatus === 'not_sent' &&
      (o.status === 'confirmed' || o.status === 'pending')
    ).length,
    shipped: orders.filter(o => o.deliveryStatus === 'sent').length,
    inTransit: orders.filter(o => o.deliveryStatus === 'in_transit').length,
    delivered: orders.filter(o => o.deliveryStatus === 'delivered').length,
  };

  // Fetch rates when provider + wilaya selected
  useEffect(() => {
    if (!sendProviderId || !sendWilaya) {
      setSendRates(null);
      return;
    }

    const provider = providers.find(p => p.id === sendProviderId);
    if (!provider) return;

    const fetchRates = async () => {
      try {
        setRatesLoading(true);
        const res = await getDeliveryRates({
          provider: provider.provider,
          toWilaya: sendWilaya,
        });
        setSendRates(res.rates);
      } catch {
        setSendRates(null);
      } finally {
        setRatesLoading(false);
      }
    };

    fetchRates();
  }, [sendProviderId, sendWilaya, providers]);

  const handleSend = async () => {
    if (!sendOrder || !sendProviderId || !sendWilaya) return;
    try {
      setSendLoading(true);
      await sendOrderToDelivery(sendOrder.id, {
        providerId: sendProviderId,
        toWilayaId: sendWilaya,
        isStopdesk: sendStopdesk,
        note: sendNote,
      });
      setSendOrder(null);
      setSendProviderId('');
      setSendWilaya(null);
      setSendStopdesk(false);
      setSendNote('');
      setSendRates(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send order');
    } finally {
      setSendLoading(false);
    }
  };

  const handleTrack = async (order: Order) => {
    setTrackOrder(order);
    setTrackData(null);
    try {
      setTrackLoading(true);
      const res = await getTrackingInfo(order.id);
      setTrackData(res.data);
    } catch (err) {
      setTrackData({ error: err instanceof Error ? err.message : 'Failed to get tracking' });
    } finally {
      setTrackLoading(false);
    }
  };

  const handleLabel = async (order: Order) => {
    try {
      const res = await getShippingLabel(order.id);
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      } else if (res.data?.pdf) {
        // base64 PDF
        const blob = new Blob(
          [Uint8Array.from(atob(res.data.pdf), c => c.charCodeAt(0))],
          { type: 'application/pdf' }
        );
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        setError('Label data not available from provider');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get label');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      not_sent: 'bg-zinc-600/20 text-zinc-400',
      sent: 'bg-blue-500/20 text-blue-400',
      in_transit: 'bg-yellow-500/20 text-yellow-400',
      delivered: 'bg-green-500/20 text-green-400',
    };
    const labels: Record<string, string> = {
      not_sent: 'Not Sent',
      sent: 'Sent',
      in_transit: 'In Transit',
      delivered: 'Delivered',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || map.not_sent}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading && orders.length === 0) {
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
          <h1 className="text-2xl font-bold text-white">Delivery</h1>
          <p className="text-zinc-400 text-sm mt-1">Send orders to delivery companies and track shipments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push('/dashboard/stock/delivery/settings')}>
            <SettingsIcon className="w-4 h-4 mr-2" />
            Providers
          </Button>
          <Button variant="secondary" onClick={loadData}>
            <RefreshIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Ready to Ship" value={stats.readyToShip} icon={<BoxIcon className="w-5 h-5" />} iconColor="text-zinc-400" />
        <StatsCard title="Shipped" value={stats.shipped} icon={<TruckIcon className="w-5 h-5" />} iconColor="text-blue-400" />
        <StatsCard title="In Transit" value={stats.inTransit} icon={<TruckIcon className="w-5 h-5" />} iconColor="text-yellow-400" />
        <StatsCard title="Delivered" value={stats.delivered} icon={<CheckCircleIcon className="w-5 h-5" />} iconColor="text-green-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm
              focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
              placeholder:text-zinc-500"
          />
        </div>
        <div className="flex gap-1 bg-zinc-900/50 border border-white/10 rounded-lg p-1">
          {(['all', 'not_sent', 'sent', 'in_transit', 'delivered'] as DeliveryFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filter === f
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'All' : f === 'not_sent' ? 'Ready' : f === 'in_transit' ? 'In Transit' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Order</th>
                <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Address</th>
                <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Provider</th>
                <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Tracking</th>
                <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-zinc-500 py-12">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-white">{order.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{order.clientName}</div>
                      {order.clientPhone && (
                        <div className="text-xs text-zinc-500">{order.clientPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-400 max-w-[200px] truncate">
                        {order.clientAddress || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-white">
                        {Number(order.total).toLocaleString()} DA
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">
                        {order.deliveryProvider || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400 font-mono">
                        {order.trackingNumber || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(order.deliveryStatus)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {order.deliveryStatus === 'not_sent' && (
                          <Button
                            variant="secondary"
                            className="text-xs"
                            onClick={() => {
                              setSendOrder(order);
                              // Pre-select default provider
                              const def = providers.find(p => p.isDefault);
                              if (def) setSendProviderId(def.id);
                            }}
                            disabled={providers.length === 0}
                          >
                            <TruckIcon className="w-3.5 h-3.5 mr-1" />
                            Send
                          </Button>
                        )}
                        {order.deliveryStatus !== 'not_sent' && order.trackingNumber && (
                          <>
                            <Button variant="secondary" className="text-xs" onClick={() => handleTrack(order)}>
                              <EyeIcon className="w-3.5 h-3.5 mr-1" />
                              Track
                            </Button>
                            <Button variant="secondary" className="text-xs" onClick={() => handleLabel(order)}>
                              <FileTextIcon className="w-3.5 h-3.5 mr-1" />
                              Label
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send to Delivery Modal */}
      <Modal
        isOpen={!!sendOrder}
        onClose={() => { setSendOrder(null); setSendRates(null); }}
        title={`Send ${sendOrder?.orderNumber} to Delivery`}
        size="lg"
      >
        {sendOrder && (
          <div className="space-y-4">
            {/* Order summary */}
            <div className="bg-black/50 border border-white/10 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Client</span>
                <span className="text-white">{sendOrder.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Phone</span>
                <span className="text-white">{sendOrder.clientPhone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Address</span>
                <span className="text-white text-right max-w-[250px] truncate">{sendOrder.clientAddress || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total</span>
                <span className="text-white font-medium">{Number(sendOrder.total).toLocaleString()} DA</span>
              </div>
            </div>

            {providers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-zinc-400 text-sm mb-3">No delivery providers configured</p>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/dashboard/stock/delivery/settings')}
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Add Provider
                </Button>
              </div>
            ) : (
              <>
                <Select
                  label="Delivery Provider"
                  value={sendProviderId}
                  onChange={e => setSendProviderId(e.target.value)}
                >
                  <option value="">Select provider...</option>
                  {providers.filter(p => p.isActive).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}{p.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </Select>

                <WilayaSelector
                  wilayas={wilayaList}
                  value={sendWilaya}
                  onChange={setSendWilaya}
                  label="Destination Wilaya"
                />

                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendStopdesk}
                    onChange={e => setSendStopdesk(e.target.checked)}
                    className="rounded border-white/20 bg-black"
                  />
                  Stop desk delivery
                </label>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Note</label>
                  <textarea
                    value={sendNote}
                    onChange={e => setSendNote(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
                      placeholder:text-zinc-500 resize-none"
                    placeholder="Optional note for the delivery company..."
                  />
                </div>

                {/* Rates preview */}
                {ratesLoading && (
                  <div className="text-sm text-zinc-400 flex items-center gap-2">
                    <RefreshIcon className="w-4 h-4 animate-spin" /> Fetching rates...
                  </div>
                )}
                {sendRates && !ratesLoading && (
                  <div className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm space-y-1">
                    <h4 className="text-zinc-300 font-medium mb-1">Estimated Rates</h4>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Home Delivery</span>
                      <span className="text-white">
                        {sendRates.home_delivery != null ? `${sendRates.home_delivery} DA` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Stop Desk</span>
                      <span className="text-white">
                        {sendRates.stopdesk != null ? `${sendRates.stopdesk} DA` : '—'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setSendOrder(null)}>Cancel</Button>
                  <Button
                    onClick={handleSend}
                    disabled={sendLoading || !sendProviderId || !sendWilaya}
                  >
                    {sendLoading ? 'Sending...' : 'Confirm & Send'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Tracking Modal */}
      <Modal
        isOpen={!!trackOrder}
        onClose={() => setTrackOrder(null)}
        title={`Tracking — ${trackOrder?.orderNumber}`}
        size="lg"
      >
        {trackLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshIcon className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        ) : trackData?.error ? (
          <div className="text-red-400 text-sm">{trackData.error}</div>
        ) : trackData ? (
          <div className="space-y-3">
            <div className="bg-black/50 border border-white/10 rounded-lg p-4">
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap overflow-auto max-h-96">
                {JSON.stringify(trackData, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">No tracking data available</div>
        )}
      </Modal>
    </div>
  );
}
