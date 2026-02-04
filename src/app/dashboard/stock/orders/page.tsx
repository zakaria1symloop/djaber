'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  ClipboardIcon, SearchIcon, EyeIcon, TrashIcon, PlusIcon, TruckIcon,
  PhoneIcon, CheckCircleIcon,
} from '@/components/ui/icons';
import {
  getOrders, deleteOrder, addOrderCall, updateOrder,
  type Order, type OrderCall,
} from '@/lib/user-stock-api';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmFilter, setConfirmFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [viewing, setViewing] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Call modal state
  const [callingOrder, setCallingOrder] = useState<Order | null>(null);
  const [callResult, setCallResult] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await getOrders({
        status: statusFilter || undefined,
        confirmationStatus: confirmFilter || undefined,
        search: search || undefined,
        limit: 200,
      });
      setOrders(res.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, confirmFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { loadOrders(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed': return 'info';
      case 'dispatched': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      case 'pending':
      default: return 'warning';
    }
  };

  const getConfirmVariant = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'no_answer': return 'warning';
      case 'rejected': return 'error';
      case 'not_called':
      default: return 'default';
    }
  };

  const getConfirmLabel = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'no_answer': return 'No Answer';
      case 'rejected': return 'Rejected';
      case 'not_called':
      default: return 'Not Called';
    }
  };

  const getPaymentVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'error';
      default: return 'default';
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteOrder(deleteConfirm.id);
      setOrders(orders.filter((o) => o.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCall = async () => {
    if (!callingOrder || !callResult) return;
    try {
      setSavingCall(true);
      const res = await addOrderCall(callingOrder.id, {
        result: callResult,
        notes: callNotes || undefined,
      });
      // Update order in list
      setOrders(orders.map((o) => (o.id === callingOrder.id ? res.order : o)));
      // If viewing the same order, update it
      if (viewing?.id === callingOrder.id) setViewing(res.order);
      setCallingOrder(null);
      setCallResult('');
      setCallNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save call');
    } finally {
      setSavingCall(false);
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    notCalled: orders.filter((o) => o.confirmationStatus === 'not_called').length,
    totalValue: orders.reduce((sum, o) => sum + Number(o.total), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage customer orders with call confirmation tracking
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/stock/orders/new')} icon={<PlusIcon className="w-4 h-4" />}>
          New Order
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Pending</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Need Calling</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.notCalled}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Total Value</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalValue.toLocaleString()} <span className="text-sm text-zinc-400">DA</span></p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm min-w-[150px]"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={confirmFilter}
          onChange={(e) => setConfirmFilter(e.target.value)}
          className="px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm min-w-[150px]"
        >
          <option value="">All Confirmations</option>
          <option value="not_called">Not Called</option>
          <option value="no_answer">No Answer</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table / Empty State */}
      {loading ? (
        <div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>
      ) : orders.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Order #</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Client</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Items</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Paid</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Remaining</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Confirmation</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const remaining = Math.max(0, Number(order.total) - Number(order.amountPaid));
                  return (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white">{order.clientName}</p>
                          {order.clientPhone && <p className="text-xs text-zinc-500">{order.clientPhone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-zinc-400">{order.items.length}</td>
                      <td className="px-4 py-3 text-sm text-right text-white font-medium">
                        {Number(order.total).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-400">
                        {Number(order.amountPaid).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {remaining > 0 ? `${remaining.toLocaleString()} DA` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={getConfirmVariant(order.confirmationStatus)}>
                          {getConfirmLabel(order.confirmationStatus)}
                          {order.callAttempts > 0 && ` (${order.callAttempts})`}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setCallingOrder(order)}
                            className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Log call"
                          >
                            <PhoneIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewing(order)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {order.status !== 'delivered' && (
                            <button
                              onClick={() => setDeleteConfirm(order)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete order"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center">
            <ClipboardIcon className="w-16 h-16" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Orders Yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
            Orders appear from AI chatbot confirmations, or create them manually.
          </p>
          <Button onClick={() => router.push('/dashboard/stock/orders/new')} icon={<PlusIcon className="w-4 h-4" />}>New Order</Button>
        </div>
      )}

      {/* ── View Order Detail Modal ── */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={`Order ${viewing?.orderNumber || ''}`} size="lg">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Client</p>
                <p className="text-sm text-white">{viewing.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Phone</p>
                <p className="text-sm text-white">{viewing.clientPhone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Address</p>
                <p className="text-sm text-white">{viewing.clientAddress || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p className="text-sm text-white">{new Date(viewing.orderDate).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Status</p>
                <Badge variant={getStatusVariant(viewing.status)}>{viewing.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Payment</p>
                <Badge variant={getPaymentVariant(viewing.paymentStatus)}>{viewing.paymentStatus}</Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Confirmation</p>
                <Badge variant={getConfirmVariant(viewing.confirmationStatus)}>
                  {getConfirmLabel(viewing.confirmationStatus)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Source</p>
                <Badge variant={viewing.source === 'ai' ? 'info' : 'default'}>
                  {viewing.source === 'ai' ? 'AI Chat' : 'Manual'}
                </Badge>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Total</p>
                <p className="text-lg font-bold text-white">{Number(viewing.total).toLocaleString()} DA</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Paid</p>
                <p className="text-lg font-bold text-emerald-400">{Number(viewing.amountPaid).toLocaleString()} DA</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Remaining</p>
                <p className={`text-lg font-bold ${Number(viewing.total) - Number(viewing.amountPaid) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Math.max(0, Number(viewing.total) - Number(viewing.amountPaid)).toLocaleString()} DA
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Qty</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Price</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewing.items.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-4 py-2 text-sm text-white">
                        {item.productName}
                        {item.variantName && <span className="text-xs text-zinc-500 ml-1.5">({item.variantName})</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right text-zinc-400">{Number(item.unitPrice).toLocaleString()} DA</td>
                      <td className="px-4 py-2 text-sm text-right text-white">{Number(item.total).toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Call History */}
            {viewing.calls && viewing.calls.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Call History ({viewing.callAttempts} attempt{viewing.callAttempts !== 1 ? 's' : ''})</p>
                <div className="space-y-2">
                  {viewing.calls.map((call) => (
                    <div key={call.id} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        call.result === 'picked_up' ? 'bg-emerald-500/20 text-emerald-400'
                          : call.result === 'rejected' ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <PhoneIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium capitalize">{call.result.replace('_', ' ')}</span>
                          <span className="text-xs text-zinc-500">{new Date(call.calledAt).toLocaleString()}</span>
                        </div>
                        {call.notes && <p className="text-xs text-zinc-400 mt-0.5">{call.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewing.notes && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-400">{viewing.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCallingOrder(viewing);
                  setViewing(null);
                }}
                icon={<PhoneIcon className="w-4 h-4" />}
              >
                Log Call
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Call Logging Modal ── */}
      <Modal isOpen={!!callingOrder} onClose={() => { setCallingOrder(null); setCallResult(''); setCallNotes(''); }} title={`Log Call — ${callingOrder?.orderNumber || ''}`} size="sm">
        {callingOrder && (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-sm text-white font-medium">{callingOrder.clientName}</p>
              {callingOrder.clientPhone && (
                <p className="text-sm text-blue-400 mt-0.5">{callingOrder.clientPhone}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-2">Call Result *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'picked_up', label: 'Picked Up', color: 'emerald' },
                  { value: 'no_answer', label: 'No Answer', color: 'amber' },
                  { value: 'busy', label: 'Busy', color: 'amber' },
                  { value: 'rejected', label: 'Rejected', color: 'red' },
                  { value: 'voicemail', label: 'Voicemail', color: 'zinc' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCallResult(opt.value)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      callResult === opt.value
                        ? opt.color === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : opt.color === 'red' ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : opt.color === 'amber' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300'
                        : 'bg-black border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Notes / Client Response</label>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="What did the client say?"
                rows={3}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setCallingOrder(null); setCallResult(''); setCallNotes(''); }}
                disabled={savingCall}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleAddCall}
                disabled={savingCall || !callResult}
              >
                {savingCall ? 'Saving...' : 'Save Call'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Order" size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete order <span className="text-white font-medium">{deleteConfirm?.orderNumber}</span>?
          Stock will be restored.
        </p>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
