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
