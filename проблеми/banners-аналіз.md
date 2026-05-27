# «Banners» — ТОП-5

| #   | Severity   | Що                                                                              |
| --- | ---------- | ------------------------------------------------------------------------------- |
| BN1 | 🔴 HIGH    | A/B variantGroup без перевірки що sum(variantWeight)=100 — broken traffic split |
| BN2 | 🟠 HIGH    | DELETE банера без warning якщо variantGroup має інші — orphan A/B test          |
| BN3 | 🟡 MED     | Public `/api/v1/banners` без specific rate-limit + Cache-Control                |
| BN4 | 🟢 LOW     | Upload без total-dir size cap — admin може заповнити uploads/banners            |
| BN5 | ✅ Already | HP1 (попередня сесія) — imageDesktop/imageMobile isSafeUrl ✓                    |
