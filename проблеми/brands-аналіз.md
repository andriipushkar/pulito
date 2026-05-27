# «Brands» (торгові марки + бренд-сторінки) — ТОП-7

| #   | Severity | Що                                                                                                                                                               |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR1 | 🟠 HIGH  | `website` Zod `.url()` приймає `javascript:` / `data:` — рендериться у PrintableOrder; майбутній render у brand page стане XSS. `isSafeUrl` guard відсутній      |
| BR2 | 🟠 HIGH  | `logoPath` Zod без scheme guard — `javascript:` / зовнішній URL потрапляє у DB. Next/Image catches at runtime, але БД залишається з нонсенсом                    |
| BR3 | 🟡 MED   | Slug reserved-list відсутній — admin може створити slug `admin`, `api`, `catalog`, `cart` → колізія з internal routes на `/brand/{slug}`                         |
| BR4 | 🟡 MED   | DELETE: cascade `SET NULL` на `products.brandId` — admin не бачить скільки товарів втратили зв'язок з брендом. Forensics gap                                     |
| BR5 | 🟡 MED   | GET `/admin/brands` без pagination — на 200+ brands UI lag, `_count.products` для всіх рядків                                                                    |
| BR6 | 🟡 MED   | `getBrandsForCatalog` викликається на public catalog page без HTTP `Cache-Control` — heavy join (count products per brand) на кожен request                      |
| BR7 | 🟢 LOW   | `createBrandSchema.slug` regex дозволяє `""` через `.optional()` — admin POST з `slug: ""` triggers createSlug fallback; нормально, але без `min(1)` ризик drift |
