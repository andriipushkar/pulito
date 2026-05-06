import { z } from 'zod';

export const createTTNSchema = z.object({
  senderRef: z.string().min(1, 'Вкажіть відправника'),
  senderAddressRef: z.string().min(1, 'Вкажіть адресу відправника'),
  senderContactRef: z.string().min(1, 'Вкажіть контакт відправника'),
  senderPhone: z.string().min(10, 'Вкажіть телефон відправника'),
  recipientName: z.string().min(2, "Вкажіть ім'я отримувача"),
  recipientPhone: z.string().min(10, 'Вкажіть телефон отримувача'),
  recipientCityRef: z.string().min(1, 'Вкажіть місто отримувача'),
  recipientWarehouseRef: z.string().optional(),
  recipientAddressRef: z.string().optional(),
  recipientStreetRef: z.string().optional(),
  recipientBuilding: z.string().optional(),
  recipientFlat: z.string().optional(),
  payerType: z.enum(['Sender', 'Recipient', 'ThirdPerson']).default('Sender'),
  paymentMethod: z.enum(['Cash', 'NonCash']).default('Cash'),
  cargoType: z.enum(['Cargo', 'Documents', 'TiresWheels', 'Pallet', 'Parcel']).default('Parcel'),
  weight: z.number().positive('Вага має бути більше 0'),
  seatsAmount: z.number().int().min(1).default(1),
  description: z.string().min(1, 'Вкажіть опис відправлення'),
  cost: z.number().positive('Вкажіть оціночну вартість'),
  serviceType: z
    .enum(['WarehouseWarehouse', 'WarehouseDoors', 'DoorsWarehouse', 'DoorsDoors'])
    .default('WarehouseWarehouse'),
  /** Накладений платіж (cash on delivery) — сума, яку отримувач сплатить при отриманні. */
  codAmount: z.number().nonnegative().optional(),
});
