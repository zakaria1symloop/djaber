import axios from 'axios';

// ============================================================================
// Types
// ============================================================================

export interface ProviderSchema {
  id: string;
  name: string;
  website: string;
  credentials: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
  }>;
}

export interface DeliveryRates {
  home_delivery: number | null;
  stopdesk: number | null;
}

export interface CreateShipmentData {
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  to_wilaya_id: number;
  to_commune_name?: string;
  to_wilaya_name?: string;
  from_wilaya_id?: number;
  from_wilaya_name?: string;
  weight?: number;
  price?: number;
  product?: string;
  is_stopdesk?: boolean;
  note?: string;
  external_id?: string;
}

// ============================================================================
// Provider Registry (static — no external service needed)
// ============================================================================

const PROVIDERS: ProviderSchema[] = [
  {
    id: 'yalidine',
    name: 'Yalidine',
    website: 'https://yalidine.com',
    credentials: [
      { key: 'id', label: 'API ID', type: 'text', required: true },
      { key: 'token', label: 'API Token', type: 'password', required: true },
    ],
  },
  {
    id: 'zrexpress',
    name: 'ZR Express',
    website: 'https://zrexpress.com',
    credentials: [
      { key: 'token', label: 'Token', type: 'password', required: true },
      { key: 'key', label: 'Key', type: 'password', required: true },
    ],
  },
  {
    id: 'maystro',
    name: 'Maystro Delivery',
    website: 'https://maystro-delivery.com',
    credentials: [
      { key: 'token', label: 'API Token', type: 'password', required: true },
    ],
  },
];

export function getAvailableProviders(): ProviderSchema[] {
  return PROVIDERS;
}

// ============================================================================
// Yalidine — https://api.yalidine.app/v1
// ============================================================================

const yalidineApi = (creds: Record<string, string>) =>
  axios.create({
    baseURL: 'https://api.yalidine.app/v1',
    timeout: 30000,
    headers: {
      'X-API-ID': creds.id,
      'X-API-TOKEN': creds.token,
      'Content-Type': 'application/json',
    },
  });

async function yalidineTest(creds: Record<string, string>): Promise<boolean> {
  const res = await yalidineApi(creds).get('/wilayas/');
  return res.status === 200;
}

async function yalidineCreateOrder(creds: Record<string, string>, order: CreateShipmentData) {
  const parcel: Record<string, any> = {
    order_id: order.external_id || `ORD-${Date.now()}`,
    from_wilaya_name: order.from_wilaya_name || '',
    firstname: order.name,
    familyname: '',
    contact_phone: order.phone,
    address: order.address,
    to_commune_name: order.to_commune_name || '',
    to_wilaya_name: order.to_wilaya_name || '',
    product_list: order.product || 'Package',
    price: order.price || 0,
    do_insurance: false,
    declared_value: 0,
    length: 0,
    width: 0,
    height: 0,
    weight: order.weight || 0.5,
    freeshipping: false,
    is_stopdesk: order.is_stopdesk || false,
    stopdesk_id: '',
    has_exchange: false,
    product_to_collect: null,
  };

  const res = await yalidineApi(creds).post('/parcels/', [parcel]);
  const data = res.data;

  const key = parcel.order_id;
  const entry = data[key] || Object.values(data)[0];

  if (entry && entry.success === 'true') {
    return {
      success: true,
      data: entry,
      tracking: entry.tracking || null,
    };
  }

  return {
    success: false,
    data: entry,
    tracking: null,
    error: entry?.message || 'Failed to create Yalidine parcel',
  };
}

async function yalidineGetOrder(creds: Record<string, string>, tracking: string) {
  const res = await yalidineApi(creds).get(`/parcels/${tracking}`);
  const data = res.data;
  if (data.total_data === 0) {
    throw new Error(`Tracking ID not found: ${tracking}`);
  }
  return data.data[0];
}

async function yalidineGetLabel(creds: Record<string, string>, tracking: string) {
  const order = await yalidineGetOrder(creds, tracking);
  return { type: 'url', data: order.label || null };
}

async function yalidineGetRates(creds: Record<string, string>, fromWilaya: number, toWilaya: number) {
  const res = await yalidineApi(creds).get('/fees/', {
    params: { from_wilaya_id: fromWilaya, to_wilaya_id: toWilaya },
  });
  const fees = res.data;
  if (Array.isArray(fees) && fees.length > 0) {
    const entry = fees[0];
    return {
      home_delivery: entry.home_fee ?? entry.tarif_domicile ?? null,
      stopdesk: entry.desk_fee ?? entry.tarif_stopdesk ?? null,
    };
  }
  return { home_delivery: null, stopdesk: null };
}

// ============================================================================
// ZR Express (Procolis) — https://procolis.com/api_v1
// ============================================================================

const zrApi = (creds: Record<string, string>) =>
  axios.create({
    baseURL: 'https://procolis.com/api_v1',
    timeout: 30000,
    headers: {
      token: creds.token,
      key: creds.key,
      'Content-Type': 'application/json',
    },
  });

async function zrTest(creds: Record<string, string>): Promise<boolean> {
  const res = await zrApi(creds).get('/token');
  return res.data?.Statut === 'Accès activé';
}

async function zrCreateOrder(creds: Record<string, string>, order: CreateShipmentData) {
  const colis: Record<string, any> = {
    TypeLivraison: order.is_stopdesk ? 1 : 0,
    TypeColis: 0,
    Confrimee: 1,
    Client: order.name,
    MobileA: order.phone,
    MobileB: order.phone2 || '',
    Adresse: order.address,
    IDWilaya: order.to_wilaya_id,
    Commune: order.to_commune_name || '',
    Total: order.price || 0,
    Note: order.note || '',
    TProduit: order.product || 'Package',
    id_Externe: order.external_id || '',
    Source: '',
  };

  const res = await zrApi(creds).post('/add_colis', { Colis: [colis] });
  const entry = res.data?.Colis?.[0];

  if (entry?.MessageRetour === 'Good') {
    return {
      success: true,
      data: entry,
      tracking: entry.Tracking || null,
    };
  }

  return {
    success: false,
    data: entry,
    tracking: null,
    error: entry?.MessageRetour || 'Failed to create ZR Express order',
  };
}

async function zrGetOrder(creds: Record<string, string>, tracking: string) {
  const res = await zrApi(creds).post('/lire', {
    Colis: [{ Tracking: tracking }],
  });
  if (!res.data || res.data === 'null') {
    throw new Error(`Tracking ID not found: ${tracking}`);
  }
  return res.data?.Colis?.[0] || res.data;
}

async function zrGetRates(creds: Record<string, string>, _fromWilaya: number, toWilaya: number) {
  const res = await zrApi(creds).post('/tarification');
  const allRates = res.data;
  if (Array.isArray(allRates)) {
    const entry = allRates.find((w: any) => Number(w.IDWilaya) === toWilaya);
    if (entry) {
      return {
        home_delivery: entry.Domicile ?? entry.TarifLivraison ?? null,
        stopdesk: entry.Stopdesk ?? entry.TarifStopdesk ?? null,
      };
    }
  }
  return { home_delivery: null, stopdesk: null };
}

// ============================================================================
// Maystro Delivery — https://backend.maystro-delivery.com/api
// ============================================================================

const maystroApi = (creds: Record<string, string>) =>
  axios.create({
    baseURL: 'https://backend.maystro-delivery.com/api',
    timeout: 30000,
    headers: {
      Authorization: `Token ${creds.token}`,
      'Content-Type': 'application/json',
    },
  });

async function maystroTest(creds: Record<string, string>): Promise<boolean> {
  const res = await maystroApi(creds).get('/base/wilayas/?country=1');
  return res.status === 200 || res.status === 201;
}

async function maystroCreateOrder(creds: Record<string, string>, order: CreateShipmentData) {
  const body: Record<string, any> = {
    wilaya: order.to_wilaya_id,
    commune: order.to_commune_name ? 0 : 1,
    destination_text: order.address,
    customer_phone: order.phone,
    customer_name: order.name,
    product_price: Math.round(order.price || 0),
    delivery_type: order.is_stopdesk ? 1 : 0,
    express: false,
    note_to_driver: order.note || '',
    products: [{ name: order.product || 'Package', quantity: 1 }],
    source: 4,
    external_order_id: order.external_id || '',
  };

  const res = await maystroApi(creds).post('/stores/orders/', body);

  if (res.status === 200 || res.status === 201) {
    return {
      success: true,
      data: res.data,
      tracking: res.data?.tracking || res.data?.id?.toString() || null,
    };
  }

  return {
    success: false,
    data: res.data,
    tracking: null,
    error: 'Failed to create Maystro order',
  };
}

async function maystroGetOrder(creds: Record<string, string>, tracking: string) {
  const res = await maystroApi(creds).get(`/stores/orders/${tracking}/`);
  if (res.status === 200 || res.status === 201) {
    return res.data;
  }
  throw new Error(`Order not found: ${tracking}`);
}

async function maystroGetLabel(creds: Record<string, string>, orderId: string) {
  const res = await maystroApi(creds).post(
    '/delivery/starter/starter_bordureau/',
    { all_created: true, orders_ids: [orderId] },
    { responseType: 'arraybuffer' }
  );

  if ((res.status === 200 || res.status === 201) && res.data) {
    const base64 = Buffer.from(res.data).toString('base64');
    return { type: 'pdf', data: base64 };
  }
  throw new Error('Failed to retrieve label');
}

// ============================================================================
// Unified Interface
// ============================================================================

export async function testCredentials(
  provider: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  try {
    let valid = false;
    switch (provider) {
      case 'yalidine':
        valid = await yalidineTest(credentials);
        break;
      case 'zrexpress':
        valid = await zrTest(credentials);
        break;
      case 'maystro':
        valid = await maystroTest(credentials);
        break;
      default:
        return { success: false, message: `Unsupported provider: ${provider}` };
    }
    return valid
      ? { success: true, message: 'Credentials are valid' }
      : { success: false, message: 'Invalid credentials' };
  } catch (err: any) {
    const msg = err.response?.status === 401
      ? 'Invalid credentials'
      : err.message || 'Connection failed';
    return { success: false, message: msg };
  }
}

export async function createShipment(
  provider: string,
  credentials: Record<string, string>,
  order: CreateShipmentData
): Promise<{ success: boolean; data: any; tracking: string | null; error?: string }> {
  switch (provider) {
    case 'yalidine':
      return yalidineCreateOrder(credentials, order);
    case 'zrexpress':
      return zrCreateOrder(credentials, order);
    case 'maystro':
      return maystroCreateOrder(credentials, order);
    default:
      return { success: false, data: null, tracking: null, error: `Unsupported provider: ${provider}` };
  }
}

export async function getShipmentStatus(
  provider: string,
  credentials: Record<string, string>,
  tracking: string
): Promise<{ success: boolean; data: any }> {
  try {
    let data;
    switch (provider) {
      case 'yalidine':
        data = await yalidineGetOrder(credentials, tracking);
        break;
      case 'zrexpress':
        data = await zrGetOrder(credentials, tracking);
        break;
      case 'maystro':
        data = await maystroGetOrder(credentials, tracking);
        break;
      default:
        return { success: false, data: { error: `Unsupported provider: ${provider}` } };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, data: { error: err.message } };
  }
}

export async function getShipmentLabel(
  provider: string,
  credentials: Record<string, string>,
  tracking: string
): Promise<{ success: boolean; data: any }> {
  try {
    let data;
    switch (provider) {
      case 'yalidine':
        data = await yalidineGetLabel(credentials, tracking);
        break;
      case 'maystro':
        data = await maystroGetLabel(credentials, tracking);
        break;
      case 'zrexpress':
        return { success: false, data: { error: 'Labels not supported by ZR Express' } };
      default:
        return { success: false, data: { error: `Unsupported provider: ${provider}` } };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, data: { error: err.message } };
  }
}

export async function getDeliveryRates(
  provider: string,
  credentials: Record<string, string>,
  fromWilaya: number,
  toWilaya: number
): Promise<{ success: boolean; rates: DeliveryRates }> {
  try {
    let rates: DeliveryRates;
    switch (provider) {
      case 'yalidine':
        rates = await yalidineGetRates(credentials, fromWilaya, toWilaya);
        break;
      case 'zrexpress':
        rates = await zrGetRates(credentials, fromWilaya, toWilaya);
        break;
      case 'maystro':
        return { success: false, rates: { home_delivery: null, stopdesk: null } };
      default:
        return { success: false, rates: { home_delivery: null, stopdesk: null } };
    }
    return { success: true, rates };
  } catch (err: any) {
    return { success: false, rates: { home_delivery: null, stopdesk: null } };
  }
}
