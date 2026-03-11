'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

interface CreateTTNFormProps {
  orderId: number;
  recipientName: string;
  recipientPhone: string;
  recipientCity: string | null;
  recipientWarehouseRef: string | null;
  orderAmount: number;
  onCreated: (trackingNumber: string) => void;
  onCancel: () => void;
}

interface CityResult {
  Ref: string;
  MainDescription: string;
  Area: string;
  Region: string;
  DeliveryCity: string;
  Present: string;
  Warehouses: string;
}

interface WarehouseResult {
  Ref: string;
  Description: string;
  Number: string;
  ShortAddress: string;
  TypeOfWarehouse: string;
}

export default function CreateTTNForm({
  orderId,
  recipientName,
  recipientPhone,
  recipientCity,
  recipientWarehouseRef,
  orderAmount,
  onCreated,
  onCancel,
}: CreateTTNFormProps) {
  // Sender (from env/config — stored locally, could be admin settings)
  const [senderRef, setSenderRef] = useState('');
  const [senderAddressRef, setSenderAddressRef] = useState('');
  const [senderContactRef, setSenderContactRef] = useState('');
  const [senderPhone, setSenderPhone] = useState('');

  // Recipient
  const [cityQuery, setCityQuery] = useState(recipientCity || '');
  const [cities, setCities] = useState<CityResult[]>([]);
  const [selectedCityRef, setSelectedCityRef] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [warehouseQuery, setWarehouseQuery] = useState('');
  const [warehouses, setWarehouses] = useState<WarehouseResult[]>([]);
  const [selectedWarehouseRef, setSelectedWarehouseRef] = useState(recipientWarehouseRef || '');
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

  // Cargo
  const [weight, setWeight] = useState('0.5');
  const [seatsAmount, setSeatsAmount] = useState('1');
  const [description, setDescription] = useState('Побутова хімія');
  const [cost, setCost] = useState(String(orderAmount));
  const [payerType, setPayerType] = useState<'Sender' | 'Recipient'>('Recipient');
  const [serviceType, setServiceType] = useState<'WarehouseWarehouse' | 'WarehouseDoors'>('WarehouseWarehouse');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const cityTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const warehouseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load sender settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('np_sender_settings');
      if (saved) {
        const s = JSON.parse(saved);
        setSenderRef(s.senderRef || '');
        setSenderAddressRef(s.senderAddressRef || '');
        setSenderContactRef(s.senderContactRef || '');
        setSenderPhone(s.senderPhone || '');
      }
    } catch { /* ignore */ }
  }, []);

  // Save sender settings
  const saveSenderSettings = () => {
    localStorage.setItem('np_sender_settings', JSON.stringify({
      senderRef, senderAddressRef, senderContactRef, senderPhone,
    }));
  };

  // City search
  useEffect(() => {
    if (cityQuery.length < 2 || selectedCityRef) return;
    clearTimeout(cityTimeoutRef.current);
    cityTimeoutRef.current = setTimeout(async () => {
      const res = await apiClient.get<CityResult[]>(`/api/v1/delivery/cities?q=${encodeURIComponent(cityQuery)}`);
      if (res.success && res.data) {
        // Nova Poshta returns nested Addresses array
        const data = res.data as unknown as { Addresses?: CityResult[] }[];
        const addresses = data[0]?.Addresses || (res.data as unknown as CityResult[]);
        setCities(Array.isArray(addresses) ? addresses : []);
        setShowCityDropdown(true);
      }
    }, 300);
    return () => clearTimeout(cityTimeoutRef.current);
  }, [cityQuery, selectedCityRef]);

  // Warehouse search
  useEffect(() => {
    if (!selectedCityRef) return;
    clearTimeout(warehouseTimeoutRef.current);
    warehouseTimeoutRef.current = setTimeout(async () => {
      const q = warehouseQuery ? `&q=${encodeURIComponent(warehouseQuery)}` : '';
      const res = await apiClient.get<WarehouseResult[]>(`/api/v1/delivery/warehouses?cityRef=${selectedCityRef}${q}`);
      if (res.success && res.data) {
        setWarehouses(res.data as unknown as WarehouseResult[]);
        if (warehouseQuery) setShowWarehouseDropdown(true);
      }
    }, 300);
    return () => clearTimeout(warehouseTimeoutRef.current);
  }, [selectedCityRef, warehouseQuery]);

  // Load warehouses on city select
  useEffect(() => {
    if (!selectedCityRef) return;
    apiClient.get<WarehouseResult[]>(`/api/v1/delivery/warehouses?cityRef=${selectedCityRef}`).then((res) => {
      if (res.success && res.data) {
        setWarehouses(res.data as unknown as WarehouseResult[]);
      }
    });
  }, [selectedCityRef]);

  const selectCity = (city: CityResult) => {
    setCityQuery(city.Present || city.MainDescription);
    setSelectedCityRef(city.DeliveryCity || city.Ref);
    setShowCityDropdown(false);
    setSelectedWarehouseRef('');
    setWarehouseQuery('');
  };

  const selectWarehouse = (wh: WarehouseResult) => {
    setWarehouseQuery(wh.Description);
    setSelectedWarehouseRef(wh.Ref);
    setShowWarehouseDropdown(false);
  };

  const handleCreate = async () => {
    setError('');

    if (!senderRef || !senderAddressRef || !senderContactRef || !senderPhone) {
      setError('Заповніть дані відправника. Ref можна знайти в кабінеті Нової Пошти.');
      return;
    }
    if (!selectedCityRef) {
      setError('Оберіть місто отримувача');
      return;
    }
    if (serviceType === 'WarehouseWarehouse' && !selectedWarehouseRef) {
      setError('Оберіть відділення отримувача');
      return;
    }

    saveSenderSettings();
    setIsCreating(true);

    const res = await apiClient.post(`/api/v1/admin/orders/${orderId}/ttn`, {
      senderRef,
      senderAddressRef,
      senderContactRef,
      senderPhone,
      recipientName,
      recipientPhone,
      recipientCityRef: selectedCityRef,
      recipientWarehouseRef: serviceType === 'WarehouseWarehouse' ? selectedWarehouseRef : undefined,
      payerType,
      paymentMethod: 'Cash',
      cargoType: 'Parcel',
      weight: parseFloat(weight) || 0.5,
      seatsAmount: parseInt(seatsAmount) || 1,
      description,
      cost: parseFloat(cost) || orderAmount,
      serviceType,
    });

    if (res.success) {
      const data = res.data as { trackingNumber: string };
      onCreated(data.trackingNumber);
    } else {
      setError(res.error || 'Помилка створення ТТН');
    }
    setIsCreating(false);
  };

  return (
    <div className="space-y-4">
      {/* Sender settings (collapsible) */}
      <details className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-secondary)]">
          Дані відправника (Ref з кабінету НП)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-[var(--color-text-secondary)]">Sender Ref</label>
            <input
              value={senderRef}
              onChange={(e) => setSenderRef(e.target.value)}
              placeholder="UUID відправника"
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[var(--color-text-secondary)]">Sender Address Ref</label>
            <input
              value={senderAddressRef}
              onChange={(e) => setSenderAddressRef(e.target.value)}
              placeholder="UUID адреси"
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[var(--color-text-secondary)]">Contact Sender Ref</label>
            <input
              value={senderContactRef}
              onChange={(e) => setSenderContactRef(e.target.value)}
              placeholder="UUID контакту"
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[var(--color-text-secondary)]">Телефон відправника</label>
            <input
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="+380..."
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <p className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
          Дані зберігаються в браузері. Знайти Ref можна в API-налаштуваннях кабінету Нової Пошти.
        </p>
      </details>

      {/* Recipient */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Отримувач</label>
          <input
            value={recipientName}
            readOnly
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Телефон</label>
          <input
            value={recipientPhone}
            readOnly
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* City search */}
      <div className="relative">
        <label className="mb-1 block text-xs font-medium">Місто</label>
        <input
          value={cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setSelectedCityRef('');
          }}
          placeholder="Пошук міста..."
          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
        />
        {showCityDropdown && cities.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
            {cities.map((c, i) => (
              <button
                key={i}
                onClick={() => selectCity(c)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
              >
                {c.Present || c.MainDescription}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse */}
      {serviceType === 'WarehouseWarehouse' && selectedCityRef && (
        <div className="relative">
          <label className="mb-1 block text-xs font-medium">Відділення</label>
          <input
            value={warehouseQuery}
            onChange={(e) => {
              setWarehouseQuery(e.target.value);
              setSelectedWarehouseRef('');
            }}
            placeholder="Пошук відділення..."
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          />
          {showWarehouseDropdown && warehouses.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
              {warehouses.map((w) => (
                <button
                  key={w.Ref}
                  onClick={() => selectWarehouse(w)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  {w.Description}
                </button>
              ))}
            </div>
          )}
          {!showWarehouseDropdown && warehouses.length > 0 && !selectedWarehouseRef && (
            <div className="mt-1 max-h-36 overflow-y-auto">
              {warehouses.slice(0, 10).map((w) => (
                <button
                  key={w.Ref}
                  onClick={() => selectWarehouse(w)}
                  className="w-full px-2 py-1 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  {w.Description}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cargo details */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium">Тип доставки</label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as typeof serviceType)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          >
            <option value="WarehouseWarehouse">Відділення-Відділення</option>
            <option value="WarehouseDoors">Відділення-Двері</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Платник</label>
          <select
            value={payerType}
            onChange={(e) => setPayerType(e.target.value as typeof payerType)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          >
            <option value="Recipient">Отримувач</option>
            <option value="Sender">Відправник</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Вага (кг)</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Місць</label>
          <input
            type="number"
            min="1"
            value={seatsAmount}
            onChange={(e) => setSeatsAmount(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Опис вантажу</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Оціночна вартість (грн)</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Скасувати
        </Button>
        <Button onClick={handleCreate} isLoading={isCreating}>
          Створити ТТН
        </Button>
      </div>
    </div>
  );
}
