import 'dotenv/config';
/**
 * Smoke-test the Ukrposhta eCom integration against the REAL/sandbox API.
 *
 * Reads the two tokens from env (UKRPOSHTA_BEARER_TOKEN +
 * UKRPOSHTA_COUNTERPARTY_TOKEN) — or pass them inline:
 *   UKRPOSHTA_BEARER_TOKEN=... UKRPOSHTA_COUNTERPARTY_TOKEN=... \
 *     npx tsx scripts/test-ukrposhta-ecom.ts
 *
 * It walks the documented flow (address → client → shipment) and prints each
 * raw response so you can confirm field names and units (weight grams vs kg,
 * dimensions cm vs mm) before trusting the integration in production.
 *
 * NOTE: this CREATES a real test shipment if your tokens are production tokens.
 * Use sandbox/test credentials.
 */

const BEARER = process.env.UKRPOSHTA_BEARER_TOKEN ?? '';
const TOKEN = process.env.UKRPOSHTA_COUNTERPARTY_TOKEN ?? '';
const BASE = 'https://www.ukrposhta.ua/ecom/0.0.1';

function assertTokens() {
  if (!BEARER) throw new Error('UKRPOSHTA_BEARER_TOKEN не задано');
  if (!TOKEN) throw new Error('UKRPOSHTA_COUNTERPARTY_TOKEN не задано');
}

async function call(
  path: string,
  {
    method = 'GET',
    body,
    withToken = false,
  }: { method?: string; body?: unknown; withToken?: boolean } = {},
) {
  let url = `${BASE}${path}`;
  if (withToken) url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${BEARER}`,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(`\n${method} ${path} → ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok) throw new Error(`Запит ${path} провалився: ${res.status}`);
  return json as any;
}

(async () => {
  assertTokens();

  // 1) sender address
  const senderAddr = await call('/addresses', {
    method: 'POST',
    body: {
      postcode: '79000',
      region: 'Львівська',
      city: 'Львів',
      street: 'Площа Ринок',
      houseNumber: '1',
    },
  });

  // 2) sender client (ENTERPRISE)
  const sender = await call('/clients', {
    method: 'POST',
    withToken: true,
    body: {
      name: 'Pulito Trade (TEST)',
      phoneNumber: '+380501112233',
      addressId: senderAddr.id,
      type: 'ENTERPRISE',
    },
  });

  // 3) recipient address + client
  const recipientAddr = await call('/addresses', {
    method: 'POST',
    body: {
      postcode: '01001',
      region: 'Київська',
      city: 'Київ',
      street: 'Хрещатик',
      houseNumber: '1',
    },
  });
  const recipient = await call('/clients', {
    method: 'POST',
    withToken: true,
    body: {
      name: 'Тест Отримувач',
      phoneNumber: '+380509998877',
      addressId: recipientAddr.id,
      type: 'INDIVIDUAL',
    },
  });

  // 4) shipment — check the returned deliveryPrice + barcode
  const shipment = await call('/shipments', {
    method: 'POST',
    withToken: true,
    body: {
      sender: { uuid: sender.uuid },
      recipient: { uuid: recipient.uuid },
      deliveryType: 'W2W',
      parcels: [{ name: 'Тестовий товар', weight: 1000, length: 20, declaredPrice: 500 }],
      description: 'Тестове відправлення',
    },
  });

  console.log(
    '\n✅ OK. uuid:',
    shipment.uuid,
    'barcode:',
    shipment.barcode,
    'deliveryPrice:',
    shipment.deliveryPrice,
  );
  console.log(
    'Перевірте одиниці виміру weight/declaredPrice/deliveryPrice вище перед продакшеном.',
  );
})().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
