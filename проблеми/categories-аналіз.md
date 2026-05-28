# Аналіз «Categories» (`/admin/categories`)

## ТОП-7

| #   | Що                                                                | Severity             |
| --- | ----------------------------------------------------------------- | -------------------- |
| C1  | Циклічна parent-child: A→B→A можлива через updateCategory         | 🔴 HIGH              |
| C2  | Delete не перевіряє child categories — orphans з invalid parentId | 🟠 HIGH              |
| C3  | AI rate-limit відсутній на двох category AI endpoints             | 🟠 HIGH (фінансовий) |
| C4  | Merge не атомарний при rapid double-call — partial state          | 🟠 MED               |
| C5  | Bulk delete теж orphanує children                                 | 🟠 MED               |
| C6  | SEO meta caps 160/320 — допускає bloated metas (best: 60/160)     | 🟡 MED               |
| C7  | Reorder race на двох вкладках — stale indexes                     | 🟡 MED               |
| C8  | Slug uniqueness без soft-delete check                             | 🟢 LOW               |

## Re-audit 2026-05-28 (C9–C15) — commit 3ff7e5d

| #   | Що                                                                                          | Severity | Статус                                                                      |
| --- | ------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| C8  | (re-checked) `getCategoryBySlug` без `deletedAt` → публічний catalog/[slug] віддає видалену | 🟠 MED   | ✅ `findFirst` + `deletedAt: null`                                          |
| C12 | iconPath/coverImage = bare `z.string()` → `javascript:`/`data:` URL injection               | 🟠 MED   | ✅ `isSafeUrl` refine у валідаторі                                          |
| C13 | UI обмежує 2 рівні лише клієнтсько; API приймає 3-й рівень                                  | 🟠 MED   | ✅ server-side depth-guard у create/updateCategory                          |
| C9  | updateCategory PUT без logAudit (лише DELETE логувався)                                     | 🟡 MED   | ✅ logAudit (data_update + fields)                                          |
| C14 | reorder без logAudit                                                                        | 🟢 LOW   | ✅ logAudit (action: reorder, count)                                        |
| C10 | AI-generate routes без logAudit                                                             | 🟢 LOW   | skip — лише генерують/повертають, без запису в БД (rate-limit вже є)        |
| C7  | reorder race на 2 вкладках                                                                  | —        | ✅ already mitigated — reorder у `$transaction`; stale tab = клієнтський UX |
| C15 | SEO caps валідатор 160/320 vs UI 70/160                                                     | 🟢 LOW   | skip — низька цінність; звуження ризикує відхиляти наявні довгі meta        |

> Побічно: `tsc --noEmit` показував 2 **передіснуючі** помилки типів у `catalog/page.tsx:122` та `brand/[slug]/page.tsx:106` — products list union `X[] | ProductListItem[]`. ✅ Виправлено (commit 1e0c033): `getProducts` отримав явну анотацію return-типу `Promise<{ products: ProductListItem[]; total: number }>`, що схлопує union (cached-гілка vs `serializeProducts<T>(): T[]`). Решта tsc-помилок — лише у тест-файлах.
