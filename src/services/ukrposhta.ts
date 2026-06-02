import { getUkrposhtaCreds } from '@/services/integration-credentials';
import { getSettings } from '@/services/settings';

export class UkrposhtaError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'UkrposhtaError';
  }
}

const STATUS_TRACKING_URL = 'https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/last';
const ECOM_API_URL = 'https://www.ukrposhta.ua/ecom/0.0.1';

/**
 * Low-level eCom request helper.
 *
 * Ukrposhta's eCom API uses a TWO-token scheme:
 *  - `Authorization: Bearer {bearer eCom}` — always (the production/sandbox key)
 *  - `?token={counterparty/user token}` — query param required by EVERY endpoint
 *    EXCEPT `/addresses`. Set `withToken: true` for those.
 * Confirmed against the official portal text and two independent SDKs
 * (martinjack/UkrposhtaAPI, flinebux/ukrposhta-api).
 */
interface EcomOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  withToken?: boolean;
  accept?: string;
}

async function ecom(path: string, opts: EcomOpts = {}): Promise<Response> {
  const { bearerToken, counterpartyToken } = await getUkrposhtaCreds();
  if (!bearerToken) {
    throw new UkrposhtaError('Ukrposhta API token not configured');
  }

  let url = `${ECOM_API_URL}${path}`;
  if (opts.withToken) {
    if (!counterpartyToken) {
      throw new UkrposhtaError('Не налаштовано токен контрагента Укрпошти (counterparty token)');
    }
    url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(counterpartyToken)}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
    Accept: opts.accept ?? 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  return fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function ecomJson<T>(path: string, opts: EcomOpts = {}): Promise<T> {
  const res = await ecom(path, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new UkrposhtaError(
      `Помилка API Укрпошти (${path}): ${res.status} ${text}`.trim(),
      res.status >= 500 ? 502 : res.status,
    );
  }
  return (await res.json()) as T;
}

// ----------------------------------------------------------------------------
// Tracking
// ----------------------------------------------------------------------------

export interface UkrposhtaTrackingStatus {
  barcode: string;
  step: number;
  date: string;
  index: string;
  name: string;
  event: string;
  eventName: string;
  country: string;
  eventReason: string;
  eventReasonName: string;
  mailType: number;
  indexOrder: string;
}

export async function trackParcel(barcode: string): Promise<UkrposhtaTrackingStatus> {
  const { bearerToken: token } = await getUkrposhtaCreds();
  if (!token) {
    throw new UkrposhtaError('Ukrposhta API token not configured');
  }

  const res = await fetch(`${STATUS_TRACKING_URL}?barcode=${encodeURIComponent(barcode)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new UkrposhtaError('Відправлення не знайдено', 404);
    }
    throw new UkrposhtaError(
      `Помилка API Укрпошти: ${res.status}`,
      res.status >= 500 ? 502 : res.status,
    );
  }

  const data = await res.json();
  return data as UkrposhtaTrackingStatus;
}

// ----------------------------------------------------------------------------
// Addresses  (POST /addresses — Bearer only, NO ?token=)
// ----------------------------------------------------------------------------

export interface UkrposhtaAddressInput {
  postcode: string;
  region?: string;
  district?: string;
  city: string;
  street?: string;
  houseNumber?: string;
  apartmentNumber?: string;
}

export interface UkrposhtaAddress {
  id: number;
  postcode: string;
  city: string;
}

export async function createAddress(input: UkrposhtaAddressInput): Promise<UkrposhtaAddress> {
  return ecomJson<UkrposhtaAddress>('/addresses', { method: 'POST', body: input });
}

// ----------------------------------------------------------------------------
// Clients  (POST /clients?token= — needs an addressId from createAddress)
// ----------------------------------------------------------------------------

export interface UkrposhtaClientInput {
  name: string;
  phoneNumber: string;
  addressId: number;
  /** INDIVIDUAL for customers, ENTERPRISE for the shop as a legal entity. */
  type?: 'INDIVIDUAL' | 'ENTERPRISE';
  email?: string;
}

export interface UkrposhtaClient {
  uuid: string;
  name: string;
}

export async function createClient(input: UkrposhtaClientInput): Promise<UkrposhtaClient> {
  const body = {
    name: input.name,
    phoneNumber: input.phoneNumber,
    addressId: input.addressId,
    type: input.type ?? 'INDIVIDUAL',
    ...(input.email ? { email: input.email } : {}),
  };
  return ecomJson<UkrposhtaClient>('/clients', { method: 'POST', body, withToken: true });
}

// ----------------------------------------------------------------------------
// Shipments  (POST /shipments?token=)
// ----------------------------------------------------------------------------

export interface ShipmentParcel {
  name?: string;
  /** Weight in GRAMS (Ukrposhta eCom unit — verify against your account docs). */
  weight: number;
  /** Dimensions in CM. */
  length?: number;
  width?: number;
  height?: number;
  declaredPrice: number;
}

export interface ShipmentParty {
  name: string;
  phone: string;
  address: UkrposhtaAddressInput;
}

export interface CreateShipmentInput {
  /** Sender. Omit to fall back to the shop's configured sender (settings). */
  sender?: ShipmentParty;
  /** Pre-created sender client UUID — skips sender address/client creation. */
  senderClientUuid?: string;
  recipient: ShipmentParty;
  parcels: ShipmentParcel[];
  deliveryType?: 'W2W' | 'W2D' | 'D2W' | 'D2D';
  description?: string;
  /** Cash-on-delivery (післяплата): amount in UAH to collect from recipient. */
  codAmount?: number;
  /** Who pays the delivery fee. Default: recipient pays. */
  paidByRecipient?: boolean;
}

export interface UkrposhtaShipment {
  uuid: string;
  barcode: string;
  /** Delivery cost computed by Ukrposhta and returned on creation. */
  deliveryPrice: number;
  weight?: number;
  declaredPrice?: number;
}

async function createPartyClient(party: ShipmentParty, type: 'INDIVIDUAL' | 'ENTERPRISE') {
  const addr = await createAddress(party.address);
  return createClient({
    name: party.name,
    phoneNumber: party.phone,
    addressId: addr.id,
    type,
  });
}

/**
 * Resolve the sender client UUID, in priority order:
 *  1. explicit `senderClientUuid` on the input
 *  2. explicit inline `sender` party → create address + client
 *  3. configured sender client UUID in settings
 *  4. configured structured sender address in settings → create address + client
 */
async function resolveSenderUuid(input: CreateShipmentInput): Promise<string> {
  if (input.senderClientUuid) return input.senderClientUuid;
  if (input.sender) {
    return (await createPartyClient(input.sender, 'ENTERPRISE')).uuid;
  }

  const s = (await getSettings()) as unknown as Record<string, string | undefined>;
  const configuredUuid = s.delivery_ukrposhta_sender_client_uuid;
  if (configuredUuid && configuredUuid.trim()) return configuredUuid.trim();

  const postcode = s.delivery_ukrposhta_sender_postcode;
  const city = s.delivery_ukrposhta_sender_city;
  const name = s.delivery_ukrposhta_sender_name;
  const phone = s.delivery_ukrposhta_sender_phone;
  if (postcode && city && name && phone) {
    return (
      await createPartyClient(
        {
          name,
          phone,
          address: {
            postcode,
            city,
            region: s.delivery_ukrposhta_sender_region,
            street: s.delivery_ukrposhta_sender_street,
            houseNumber: s.delivery_ukrposhta_sender_house,
          },
        },
        'ENTERPRISE',
      )
    ).uuid;
  }

  throw new UkrposhtaError(
    'Не задано відправника Укрпошти: вкажіть senderClientUuid, sender, або заповніть адресу відправника в налаштуваннях доставки',
  );
}

/**
 * Create a domestic shipment via the Ukrposhta eCom API.
 *
 * Real flow (NOT a single inline POST): create recipient address → recipient
 * client → POST /shipments referencing sender & recipient client UUIDs. The
 * response carries the server-computed `deliveryPrice`.
 */
export async function createShipment(input: CreateShipmentInput): Promise<UkrposhtaShipment> {
  if (!input.parcels?.length) {
    throw new UkrposhtaError('Потрібна хоча б одна посилка (parcels)');
  }

  const senderUuid = await resolveSenderUuid(input);
  const recipientClient = await createPartyClient(input.recipient, 'INDIVIDUAL');

  const body = {
    sender: { uuid: senderUuid },
    recipient: { uuid: recipientClient.uuid },
    deliveryType: input.deliveryType ?? 'W2W',
    parcels: input.parcels.map((p) => ({
      name: p.name ?? 'Товар',
      weight: p.weight,
      length: p.length ?? 1,
      ...(p.width ? { width: p.width } : {}),
      ...(p.height ? { height: p.height } : {}),
      declaredPrice: p.declaredPrice,
    })),
    description: input.description ?? '',
    ...(input.codAmount && input.codAmount > 0
      ? { postPay: input.codAmount, paidByRecipient: input.paidByRecipient ?? true }
      : {}),
  };

  return ecomJson<UkrposhtaShipment>('/shipments', { method: 'POST', body, withToken: true });
}

// ----------------------------------------------------------------------------
// Shipment groups (registry of shipments handed to Ukrposhta together)
// ----------------------------------------------------------------------------

export interface UkrposhtaShipmentGroup {
  uuid: string;
  name: string;
}

export async function createShipmentGroup(name: string): Promise<UkrposhtaShipmentGroup> {
  return ecomJson<UkrposhtaShipmentGroup>('/shipment-groups', {
    method: 'POST',
    body: { name },
    withToken: true,
  });
}

export async function addShipmentToGroup(
  shipmentUuid: string,
  groupUuid: string,
): Promise<unknown> {
  return ecomJson(`/shipments/${encodeURIComponent(shipmentUuid)}/shipment-group`, {
    method: 'PUT',
    body: { shipmentGroupUuid: groupUuid },
    withToken: true,
  });
}

// ----------------------------------------------------------------------------
// Printing
// ----------------------------------------------------------------------------

async function fetchPdf(path: string, label: string): Promise<Buffer> {
  const res = await ecom(path, { withToken: true, accept: 'application/pdf' });
  if (!res.ok) {
    throw new UkrposhtaError(`Помилка отримання ${label}: ${res.status}`, res.status);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** A4 shipment form (накладна). */
export async function getShipmentForm(shipmentUuid: string): Promise<Buffer> {
  return fetchPdf(`/shipments/${encodeURIComponent(shipmentUuid)}/form`, 'накладної');
}

/** 100x100 sticker label (етикетка). */
export async function getShipmentLabel(shipmentUuid: string): Promise<Buffer> {
  return fetchPdf(`/shipments/${encodeURIComponent(shipmentUuid)}/sticker`, 'етикетки');
}

/** Group registry form 103 (реєстр групи). */
export async function getGroupForm103(groupUuid: string): Promise<Buffer> {
  return fetchPdf(`/shipment-groups/${encodeURIComponent(groupUuid)}/form103`, 'реєстру (ф.103)');
}

// ----------------------------------------------------------------------------
// City search (address-classifier-ws)
// ----------------------------------------------------------------------------

/**
 * Search cities/settlements via Ukrposhta address-classifier API.
 * Returns matching cities with their postal index for autofill on checkout.
 *
 * Note: the address-classifier-ws is authenticated — it requires the same
 * Bearer token as the rest of the API (the AddressClassifier/counterparty
 * bearer issued with your contract). Calling it anonymously returns 401/403.
 */
const ADDRESS_CLASSIFIER_URL = 'https://www.ukrposhta.ua/address-classifier-ws';

/**
 * Low-level address-classifier GET helper. The classifier is authenticated with
 * the same Bearer token (header only, no ?token) and wraps every result as
 * `{ Entries: { Entry: [...] } }`.
 */
async function addressClassifier<T>(path: string): Promise<T[]> {
  const { bearerToken } = await getUkrposhtaCreds();
  if (!bearerToken) {
    throw new UkrposhtaError('Ukrposhta API token not configured');
  }
  const res = await fetch(`${ADDRESS_CLASSIFIER_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    throw new UkrposhtaError(
      `Помилка довідника адрес Укрпошти: ${res.status}`,
      res.status >= 500 ? 502 : res.status,
    );
  }
  const data = (await res.json()) as { Entries?: { Entry?: T[] } };
  return data.Entries?.Entry ?? [];
}

export interface UkrposhtaCity {
  name: string;
  postcode: string;
  region: string;
  /** CITY_ID — needed to fetch the post offices (відділення) for this city. */
  cityId: string;
}

export async function searchCities(query: string): Promise<UkrposhtaCity[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const entries = await addressClassifier<{
    CITY_UA?: string;
    CITY_ID?: number | string;
    POSTCODE?: string;
    POSTINDEX?: string;
    REGION_UA?: string;
  }>(`/get_city_by_region_id_and_district_id_and_city_ua?city_ua=${encodeURIComponent(trimmed)}`);

  const seen = new Set<string>();
  const result: UkrposhtaCity[] = [];
  for (const e of entries) {
    const name = e.CITY_UA ?? '';
    const cityId = e.CITY_ID != null ? String(e.CITY_ID) : '';
    const postcode = e.POSTCODE ?? e.POSTINDEX ?? '';
    const key = `${name}|${cityId}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push({ name, postcode, region: e.REGION_UA ?? '', cityId });
    if (result.length >= 25) break;
  }
  return result;
}

// ----------------------------------------------------------------------------
// Post offices (відділення / ВПЗ) — address-classifier
// ----------------------------------------------------------------------------

export interface UkrposhtaPostOffice {
  /** Post index (індекс) — the recipient address postcode for W2W shipments. */
  postcode: string;
  /** Human-readable office name, e.g. "Відділення №1". */
  name: string;
  address: string;
  type: string;
}

/**
 * List post offices (відділення) for a city by its CITY_ID (from searchCities).
 * Lets the checkout offer a real ВПЗ pick-list instead of free-text address.
 */
export async function getPostOfficesByCityId(cityId: string): Promise<UkrposhtaPostOffice[]> {
  const id = cityId.trim();
  if (!id) return [];
  const entries = await addressClassifier<{
    POSTINDEX?: string | number;
    POSTCODE?: string | number;
    PO_LONG?: string;
    PO_SHORT?: string;
    ADDRESS?: string;
    TYPE_LONG?: string;
    TYPE_ACRONYM?: string;
  }>(`/get_postoffices_by_city_id?city_id=${encodeURIComponent(id)}`);

  const offices: UkrposhtaPostOffice[] = [];
  for (const e of entries) {
    const postcode = e.POSTINDEX != null ? String(e.POSTINDEX) : String(e.POSTCODE ?? '');
    if (!postcode) continue;
    offices.push({
      postcode,
      name: e.PO_LONG || e.PO_SHORT || `Відділення ${postcode}`,
      address: e.ADDRESS ?? '',
      type: e.TYPE_LONG || e.TYPE_ACRONYM || '',
    });
  }
  return offices;
}

/** List post offices by a known post index (postcode). */
export async function getPostOfficesByPostcode(postcode: string): Promise<UkrposhtaPostOffice[]> {
  const pc = postcode.trim();
  if (!pc) return [];
  const entries = await addressClassifier<{
    POSTINDEX?: string | number;
    POSTCODE?: string | number;
    PO_LONG?: string;
    PO_SHORT?: string;
    ADDRESS?: string;
    TYPE_LONG?: string;
  }>(`/get_postoffices_by_postindex?pc=${encodeURIComponent(pc)}`);
  return entries
    .map((e) => ({
      postcode: e.POSTINDEX != null ? String(e.POSTINDEX) : String(e.POSTCODE ?? ''),
      name: e.PO_LONG || e.PO_SHORT || `Відділення ${pc}`,
      address: e.ADDRESS ?? '',
      type: e.TYPE_LONG ?? '',
    }))
    .filter((o) => o.postcode);
}

// ----------------------------------------------------------------------------
// Cost estimate (eCom calculation)
// ----------------------------------------------------------------------------

export interface UkrposhtaEstimateInput {
  /** Weight in grams. */
  weight: number;
  /** Declared value (UAH). */
  declaredPrice: number;
  deliveryType?: 'W2W' | 'W2D' | 'D2W' | 'D2D';
  /** Cash-on-delivery amount (UAH), if any. */
  codAmount?: number;
  /** Sender post index (required by the calc endpoint). */
  senderPostcode?: string;
  /** Recipient post index (required by the calc endpoint). */
  recipientPostcode?: string;
}

/**
 * Estimate delivery cost via the DEDICATED calculation endpoint
 * `POST /domestic/delivery-price`. This is a pure price calculation — it does
 * NOT create a shipment and does NOT take the counterparty `?token` (so it has
 * no side effects). Body matches the `ShipmentCalculationData` schema:
 * deliveryType, weight (grams), declaredPrice (UAH), addressFrom/addressTo
 * (post indexes). Returns `deliveryPrice` in UAH, or null when it can't price
 * (e.g. postcodes missing → caller falls back to a configured/flat rate).
 *
 * NB: an earlier version posted to `/shipments?type=CALCULATION`, which is NOT
 * a real endpoint — `/shipments` is the CREATE operation, so that risked
 * registering real parcels. Do not reintroduce that.
 */
export async function estimateDeliveryCost(input: UkrposhtaEstimateInput): Promise<number | null> {
  // The calc endpoint needs both post indexes; without them it cannot price.
  if (!input.senderPostcode || !input.recipientPostcode) return null;

  const { bearerToken } = await getUkrposhtaCreds();
  if (!bearerToken) return null;

  const body = {
    deliveryType: input.deliveryType ?? 'W2W',
    weight: Math.max(1, Math.round(input.weight)),
    length: 1,
    declaredPrice: input.declaredPrice,
    addressFrom: { postcode: input.senderPostcode },
    addressTo: { postcode: input.recipientPostcode },
    ...(input.codAmount && input.codAmount > 0 ? { postPay: input.codAmount } : {}),
  };

  try {
    // No `withToken` — the calculation endpoint is Bearer-only and stateless.
    const res = await ecom('/domestic/delivery-price', { method: 'POST', body });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      deliveryPrice?: number;
      rawDeliveryPrice?: number;
    };
    const price = data.deliveryPrice ?? data.rawDeliveryPrice;
    return typeof price === 'number' && price >= 0 ? price : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Cancel shipment
// ----------------------------------------------------------------------------

/** Delete (cancel) a shipment that has not yet been handed over. */
export async function cancelShipment(shipmentUuid: string): Promise<void> {
  const res = await ecom(`/shipments/${encodeURIComponent(shipmentUuid)}`, {
    method: 'DELETE',
    withToken: true,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new UkrposhtaError(
      `Не вдалося скасувати відправлення: ${res.status} ${text}`.trim(),
      res.status >= 500 ? 502 : res.status,
    );
  }
}
