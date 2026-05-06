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
    estimatedDays: result.EstimatedDeliveryDate ? String(result.EstimatedDeliveryDate) : null,
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
