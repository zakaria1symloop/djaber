/**
 * Delivery API (CourierDZ integration)
 */

import { apiRequest } from './api-config';

// ============================================================================
// Types
// ============================================================================

export interface Wilaya {
  id: number;
  code: string;
  name: string;
  nameFr: string;
  nameEn: string;
}

export interface CredentialField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface AvailableProvider {
  id: string;
  name: string;
  website: string;
  credentials: CredentialField[];
}

export interface DeliveryProvider {
  id: string;
  userId: string;
  provider: string;
  displayName: string;
  hasCredentials: boolean;
  isActive: boolean;
  isDefault: boolean;
  senderName: string | null;
  senderPhone: string | null;
  senderAddress: string | null;
  senderWilayaId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRates {
  home_delivery: number | null;
  stopdesk: number | null;
}

// ============================================================================
// Wilayas
// ============================================================================

export async function getWilayas(): Promise<{ wilayas: Wilaya[] }> {
  return apiRequest('/api/user-stock/delivery/wilayas');
}

// ============================================================================
// Provider Configuration
// ============================================================================

export async function getDeliveryProviders(): Promise<{ providers: DeliveryProvider[] }> {
  return apiRequest('/api/user-stock/delivery/providers');
}

export async function getAvailableProviders(): Promise<{ providers: AvailableProvider[] }> {
  return apiRequest('/api/user-stock/delivery/providers/available');
}

export async function addDeliveryProvider(data: {
  provider: string;
  displayName?: string;
  credentials: Record<string, string>;
  isDefault?: boolean;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  senderWilayaId?: number;
}): Promise<{ provider: DeliveryProvider }> {
  return apiRequest('/api/user-stock/delivery/providers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDeliveryProvider(
  id: string,
  data: {
    displayName?: string;
    credentials?: Record<string, string>;
    isActive?: boolean;
    isDefault?: boolean;
    senderName?: string;
    senderPhone?: string;
    senderAddress?: string;
    senderWilayaId?: number;
  }
): Promise<{ provider: DeliveryProvider }> {
  return apiRequest(`/api/user-stock/delivery/providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDeliveryProvider(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/delivery/providers/${id}`, { method: 'DELETE' });
}

export async function testDeliveryCredentials(
  provider: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  return apiRequest('/api/user-stock/delivery/providers/test', {
    method: 'POST',
    body: JSON.stringify({ provider, credentials }),
  });
}

// ============================================================================
// Delivery Operations
// ============================================================================

export async function sendOrderToDelivery(
  orderId: string,
  data: {
    providerId?: string;
    toWilayaId: number;
    toCommuneId?: number;
    isStopdesk?: boolean;
    note?: string;
  }
): Promise<{ order: any; shipment: any; tracking: string | null }> {
  return apiRequest(`/api/user-stock/delivery/send/${orderId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTrackingInfo(orderId: string): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/api/user-stock/delivery/track/${orderId}`);
}

export async function getShippingLabel(orderId: string): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/api/user-stock/delivery/label/${orderId}`);
}

export async function getDeliveryRates(params: {
  provider: string;
  toWilaya: number;
  fromWilaya?: number;
}): Promise<{ success: boolean; rates: DeliveryRates }> {
  const query = new URLSearchParams();
  query.set('provider', params.provider);
  query.set('toWilaya', params.toWilaya.toString());
  if (params.fromWilaya) query.set('fromWilaya', params.fromWilaya.toString());
  return apiRequest(`/api/user-stock/delivery/rates?${query.toString()}`);
}
