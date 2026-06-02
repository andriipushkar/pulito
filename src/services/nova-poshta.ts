import { getNovaPoshtaCreds } from '@/services/integration-credentials';

export class NovaPoshtaError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'NovaPoshtaError';
  }
}

const API_URL = 'https://api.novaposhta.ua/v2.0/json/';

interface NovaPoshtaResponse {
  success: boolean;
  data: Record<string, unknown>[];
  errors: string[];
  warnings: string[];
}

async function callApi(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  const { apiKey } = await getNovaPoshtaCreds();
  if (!apiKey) {
    throw new NovaPoshtaError('Nova Poshta API key not configured');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      modelName,
      calledMethod,
      methodProperties,
    }),
  });

  const data: NovaPoshtaResponse = await res.json();

  if (!data.success) {
    throw new NovaPoshtaError(
      data.errors.join(', ') || 'Помилка API Нової Пошти',
      res.ok ? 400 : res.status,
    );
  }

  return data.data;
}

export async function searchCities(query: string) {
  return callApi('Address', 'searchSettlements', {
    CityName: query,
    Limit: '20',
    Page: '1',
  });
}

/**
 * Search streets within a settlement for D2D (door-to-door) address delivery.
 * Returns array of streets with their Ref UUIDs that NP API requires for TTN creation.
 */
export async function searchStreets(settlementRef: string, query: string) {
  if (!query || query.length < 2) return [];
  return callApi('Address', 'searchSettlementStreets', {
    StreetName: query,
    SettlementRef: settlementRef,
    Limit: '20',
  });
}

export async function getWarehouses(cityRef: string, search?: string) {
  const props: Record<string, unknown> = {
    CityRef: cityRef,
    Limit: '50',
    Page: '1',
  };
  if (search) {
    props.FindByString = search;
  }
  return callApi('Address', 'getWarehouses', props);
}

export async function trackParcel(ttn: string) {
  return callApi('TrackingDocument', 'getStatusDocuments', {
    Documents: [{ DocumentNumber: ttn }],
  });
}

export interface EstimateDeliveryInput {
  citySender: string;
  cityRecipient: string;
  weight: number;
  serviceType: 'WarehouseWarehouse' | 'WarehouseDoors' | 'DoorsWarehouse' | 'DoorsDoors';
  cost: number;
  seatsAmount?: number;
}

export interface DeliveryCostEstimate {
  cost: number;
  estimatedDays: string | null;
}

/**
 * Estimate delivery cost via Nova Poshta getDocumentPrice API.
 */
export async function estimateDeliveryCost(
  input: EstimateDeliveryInput,
): Promise<DeliveryCostEstimate> {
  const data = await callApi('InternetDocument', 'getDocumentPrice', {
    CitySender: input.citySender,
    CityRecipient: input.cityRecipient,
    Weight: String(input.weight),
    ServiceType: input.serviceType,
    Cost: String(input.cost),
    CargoType: 'Parcel',
    SeatsAmount: String(input.seatsAmount ?? 1),
  });

  const result = data[0];
  if (!result) {
    throw new NovaPoshtaError('Не вдалося розрахувати вартість доставки');
  }

  return {
    cost: Number(result.Cost || 0),
    // NB: getDocumentPrice does NOT return a delivery date (only Cost,
    // AssessedCost, CostRedelivery, CostPack, TZoneInfo). The ETA must be
    // fetched via getDocumentDeliveryDate (getDeliveryDate) — so this is
    // always null here, intentionally.
    estimatedDays: null,
  };
}

export interface CreateTTNInput {
  senderRef: string;
  senderAddressRef: string;
  senderContactRef: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  recipientCityRef: string;
  /** UUID of warehouse / поштомат — for WarehouseWarehouse / WarehouseDoors. */
  recipientWarehouseRef?: string;
  /** Pre-built RecipientAddress UUID — alternative to streetRef + building + flat. */
  recipientAddressRef?: string;
  /** D2D structured fields (used when serviceType is WarehouseDoors / DoorsDoors). */
  recipientStreetRef?: string;
  recipientBuilding?: string;
  recipientFlat?: string;
  payerType: 'Sender' | 'Recipient' | 'ThirdPerson';
  paymentMethod: 'Cash' | 'NonCash';
  cargoType: 'Cargo' | 'Documents' | 'TiresWheels' | 'Pallet' | 'Parcel';
  weight: number;
  seatsAmount: number;
  description: string;
  cost: number;
  serviceType: 'WarehouseWarehouse' | 'WarehouseDoors' | 'DoorsWarehouse' | 'DoorsDoors';
  /** Cash-on-delivery: Nova Poshta collects this amount from recipient and returns it to sender. */
  codAmount?: number;
}

/**
 * Create an Internet Document (TTN) in Nova Poshta.
 * Returns the document number and ref.
 */
export async function createInternetDocument(input: CreateTTNInput): Promise<{
  intDocNumber: string;
  ref: string;
  costOnSite: number;
  estimatedDeliveryDate: string;
}> {
  const isD2D = input.serviceType === 'WarehouseDoors' || input.serviceType === 'DoorsDoors';

  const props: Record<string, unknown> = {
    SenderWarehouseIndex: '',
    RecipientWarehouseIndex: '',
    PayerType: input.payerType,
    PaymentMethod: input.paymentMethod,
    DateTime: new Date().toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    CargoType: input.cargoType,
    Weight: String(input.weight),
    SeatsAmount: String(input.seatsAmount),
    Description: input.description,
    Cost: String(input.cost),
    ServiceType: input.serviceType,
    Sender: input.senderRef,
    SenderAddress: input.senderAddressRef,
    ContactSender: input.senderContactRef,
    SendersPhone: input.senderPhone,
    RecipientCityName: '',
    RecipientArea: '',
    RecipientAreaRegions: '',
    RecipientAddressName: '',
    RecipientType: 'PrivatePerson',
    RecipientsPhone: input.recipientPhone,
    RecipientAddress: input.recipientWarehouseRef || input.recipientAddressRef || '',
    RecipientName: input.recipientName,
  };

  // D2D address delivery — pass street/building/flat instead of warehouse ref.
  if (isD2D) {
    props.RecipientCity = input.recipientCityRef;
    if (input.recipientStreetRef) props.RecipientStreet = input.recipientStreetRef;
    if (input.recipientBuilding) props.RecipientHouse = input.recipientBuilding;
    if (input.recipientFlat) props.RecipientFlat = input.recipientFlat;
    // Address ref takes priority if provided
    if (input.recipientAddressRef) props.RecipientAddress = input.recipientAddressRef;
  }

  // Накладений платіж — отримувач платить готівкою при отриманні, сума повертається відправнику.
  if (input.codAmount && input.codAmount > 0) {
    props.BackwardDeliveryData = [
      {
        PayerType: 'Recipient',
        CargoType: 'Money',
        RedeliveryString: String(input.codAmount),
      },
    ];
  }

  const data = await callApi('InternetDocument', 'save', props);

  const doc = data[0];
  if (!doc) {
    throw new NovaPoshtaError('Не вдалося створити ТТН');
  }

  return {
    intDocNumber: String(doc.IntDocNumber || ''),
    ref: String(doc.Ref || ''),
    costOnSite: Number(doc.CostOnSite || 0),
    estimatedDeliveryDate: String(doc.EstimatedDeliveryDate || ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Delivery date (окремий розрахунок строку доставки)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Estimate the delivery DATE (not cost) for a route. Lighter than
 * getDocumentPrice when you only need the ETA (e.g. product/cart page).
 */
export async function getDeliveryDate(input: {
  citySender: string;
  cityRecipient: string;
  serviceType: EstimateDeliveryInput['serviceType'];
  date?: string; // dd.mm.yyyy; defaults to today on NP side when empty
}): Promise<string | null> {
  const data = await callApi('InternetDocument', 'getDocumentDeliveryDate', {
    DateTime: input.date || '',
    ServiceType: input.serviceType,
    CitySender: input.citySender,
    CityRecipient: input.cityRecipient,
  });
  const res = data[0] as { DeliveryDate?: { date?: string } } | undefined;
  return res?.DeliveryDate?.date || null;
}

// ─────────────────────────────────────────────────────────────────────────
// Internet document lifecycle: cancel / update / list / get
// ─────────────────────────────────────────────────────────────────────────

/**
 * Delete (cancel) a TTN. Requires the document Ref (UUID) — the 14-digit
 * EN number is not accepted by NP for deletion. Only works while the parcel
 * has not yet been handed over to Nova Poshta.
 */
export async function deleteInternetDocument(ref: string): Promise<boolean> {
  if (!ref) throw new NovaPoshtaError('Немає Ref документа для скасування');
  const data = await callApi('InternetDocument', 'delete', { DocumentRefs: ref });
  return data.length > 0;
}

/** List created internet documents in a date range (dd.mm.yyyy). */
export async function getDocumentList(input: {
  dateFrom: string;
  dateTo: string;
  page?: number;
  limit?: number;
}) {
  return callApi('InternetDocument', 'getDocumentList', {
    DateTimeFrom: input.dateFrom,
    DateTimeTo: input.dateTo,
    Page: String(input.page ?? 1),
    GetFullList: input.limit ? '0' : '1',
    ...(input.limit ? { Limit: String(input.limit) } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Printing: build a server-side print URL (TTN PDF or sticker markings).
// The URL embeds the apiKey, so it MUST stay server-side — routes proxy the
// PDF bytes to the browser rather than exposing the link. Document NUMBERS
// (14-digit EN) are accepted here, so no Ref is required.
// ─────────────────────────────────────────────────────────────────────────

export type PrintType = 'document' | 'marking' | 'marking100x100';

/** Build the my.novaposhta.ua print URL for one or more EN numbers. */
export async function buildPrintUrl(numbers: string[], type: PrintType): Promise<string> {
  const { apiKey } = await getNovaPoshtaCreds();
  if (!apiKey) throw new NovaPoshtaError('Nova Poshta API key not configured');
  const docs = numbers.filter(Boolean).join(',');
  if (!docs) throw new NovaPoshtaError('Немає номерів ТТН для друку');

  const base = 'https://my.novaposhta.ua/orders';
  // printMarking100x100 = thermal sticker (Zebra); printDocument = full A4 TTN.
  const path =
    type === 'document'
      ? 'printDocument'
      : type === 'marking100x100'
        ? 'printMarking100x100'
        : 'printMarkings';
  return `${base}/${path}/orders[]/${docs}/type/pdf/apiKey/${apiKey}`;
}

/** Fetch the print PDF server-side and return its bytes (for streaming). */
export async function fetchPrintPdf(numbers: string[], type: PrintType): Promise<Buffer> {
  const url = await buildPrintUrl(numbers, type);
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // The print URL embeds the apiKey; on a network failure undici attaches the
    // request URL to error.cause, which would leak the key if the raw error is
    // ever logged. Swallow it and throw a clean error with no URL/cause.
    throw new NovaPoshtaError('Не вдалося звʼязатися з Новою Поштою для друку PDF');
  }
  if (!res.ok) {
    throw new NovaPoshtaError(`Не вдалося отримати PDF (${res.status})`, res.status);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // NP returns an HTML error page (not a PDF) for bad input — guard against it.
  if (buf.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new NovaPoshtaError('Нова Пошта повернула не PDF (перевірте номери ТТН)');
  }
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────
// ScanSheet (Реєстр відправлень) — group TTNs into a daily registry the
// courier scans on pickup. Operates on document Refs (UUIDs).
// ─────────────────────────────────────────────────────────────────────────

/** Add documents to a registry. Empty scanSheetRef creates a new one. */
export async function insertDocumentsToScanSheet(input: {
  documentRefs: string[];
  date?: string; // dd.mm.yyyy
  scanSheetRef?: string;
}): Promise<{ ref: string; number: string }> {
  if (!input.documentRefs.length) {
    throw new NovaPoshtaError('Немає документів для додавання в реєстр');
  }
  const data = await callApi('ScanSheet', 'insertDocuments', {
    DocumentRefs: input.documentRefs,
    Date: input.date || '',
    Ref: input.scanSheetRef || '',
  });
  const res = data[0] as { Ref?: string; Number?: string } | undefined;
  return { ref: String(res?.Ref || ''), number: String(res?.Number || '') };
}

/** List all registries. */
export async function getScanSheetList() {
  return callApi('ScanSheet', 'getScanSheetList', {});
}

/** Get one registry with its documents. */
export async function getScanSheet(input: { ref?: string; number?: string }) {
  return callApi('ScanSheet', 'getScanSheet', {
    Ref: input.ref || '',
    Number: input.number || '',
  });
}

/** Disband (delete) one or more registries. */
export async function deleteScanSheet(scanSheetRefs: string[]) {
  return callApi('ScanSheet', 'deleteScanSheet', { ScanSheetRefs: scanSheetRefs });
}

/** Remove specific documents from a registry. */
export async function removeDocumentsFromScanSheet(input: {
  documentRefs: string[];
  scanSheetRef: string;
}) {
  return callApi('ScanSheet', 'removeDocuments', {
    DocumentRefs: input.documentRefs,
    Ref: input.scanSheetRef,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// AdditionalService — returns (повернення), redirect (переадресація).
// These work with the 14-digit EN number, so no Ref is required.
// ─────────────────────────────────────────────────────────────────────────

/** Reference list of return reasons. */
export async function getReturnReasons() {
  return callApi('AdditionalService', 'getReturnReasons', {});
}

/** Subtypes for a given return reason Ref. */
export async function getReturnReasonsSubtypes(reasonRef: string) {
  return callApi('AdditionalService', 'getReturnReasonsSubtypes', { ReasonRef: reasonRef });
}

/** Check whether a return can be created for an EN number. */
export async function checkPossibilityCreateReturn(number: string) {
  return callApi('AdditionalService', 'CheckPossibilityCreateReturn', { Number: number });
}

/**
 * Create a return order back to one of our warehouses/addresses.
 * `returnAddressRef` is the sender's NP address Ref the parcel returns to.
 */
export async function createReturnOrder(input: {
  intDocNumber: string;
  reasonRef: string;
  subtypeReasonRef: string;
  returnAddressRef: string;
  paymentMethod?: 'Cash' | 'NonCash';
}): Promise<{ number: string; ref: string }> {
  const data = await callApi('AdditionalService', 'save', {
    OrderType: 'orderCargoReturn',
    IntDocNumber: input.intDocNumber,
    PaymentMethod: input.paymentMethod || 'Cash',
    Reason: input.reasonRef,
    SubtypeReason: input.subtypeReasonRef,
    ReturnAddressRef: input.returnAddressRef,
  });
  const res = data[0] as { Number?: string; Ref?: string } | undefined;
  return { number: String(res?.Number || ''), ref: String(res?.Ref || '') };
}

/** List previously created return orders (dd.mm.yyyy range optional). */
export async function getReturnOrdersList(input: { number?: string; page?: number } = {}) {
  return callApi('AdditionalService', 'getReturnOrdersList', {
    Number: input.number || '',
    Page: String(input.page ?? 1),
    Limit: '50',
  });
}

/** Delete a pending return order by its Ref. */
export async function deleteReturnOrder(ref: string) {
  return callApi('AdditionalService', 'delete', { Ref: ref, OrderType: 'orderCargoReturn' });
}

/** Check whether a parcel (EN number) can be redirected. */
export async function checkPossibilityForRedirecting(number: string) {
  return callApi('AdditionalService', 'checkPossibilityForRedirecting', { Number: number });
}

/**
 * Redirect a parcel to another warehouse (most common case for a shop).
 * `recipientWarehouseRef` is the destination відділення Ref.
 */
export async function createRedirectOrder(input: {
  intDocNumber: string;
  recipientWarehouseRef: string;
  payerType?: 'Sender' | 'Recipient';
  paymentMethod?: 'Cash' | 'NonCash';
  note?: string;
}): Promise<{ number: string; ref: string }> {
  const data = await callApi('AdditionalService', 'save', {
    OrderType: 'orderRedirecting',
    IntDocNumber: input.intDocNumber,
    Customer: 'Recipient',
    ServiceType: 'WarehouseWarehouse',
    RecipientWarehouse: input.recipientWarehouseRef,
    PayerType: input.payerType || 'Recipient',
    PaymentMethod: input.paymentMethod || 'Cash',
    Note: input.note || '',
  });
  const res = data[0] as { Number?: string; Ref?: string } | undefined;
  return { number: String(res?.Number || ''), ref: String(res?.Ref || '') };
}

/** List previously created redirect orders. */
export async function getRedirectionOrdersList(input: { number?: string; page?: number } = {}) {
  return callApi('AdditionalService', 'getRedirectionOrdersList', {
    Number: input.number || '',
    Page: String(input.page ?? 1),
    Limit: '50',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Counterparty / ContactPerson — manage the SENDER side so the TTN form can
// be populated from the NP cabinet instead of hardcoded refs.
// ─────────────────────────────────────────────────────────────────────────

/** List counterparties of a given side (default: our senders). */
export async function getCounterparties(property: 'Sender' | 'Recipient' = 'Sender', page = 1) {
  return callApi('Counterparty', 'getCounterparties', {
    CounterpartyProperty: property,
    Page: String(page),
  });
}

/** Contact persons attached to a counterparty Ref. */
export async function getCounterpartyContactPersons(counterpartyRef: string, page = 1) {
  return callApi('Counterparty', 'getCounterpartyContactPersons', {
    Ref: counterpartyRef,
    Page: String(page),
  });
}

/** Addresses attached to a counterparty Ref. */
export async function getCounterpartyAddresses(
  counterpartyRef: string,
  property: 'Sender' | 'Recipient' = 'Sender',
) {
  return callApi('Counterparty', 'getCounterpartyAddresses', {
    Ref: counterpartyRef,
    CounterpartyProperty: property,
  });
}
