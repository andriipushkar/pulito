# «Homepage» builder — ТОП-5

| #   | Severity | Що                                                                                              |
| --- | -------- | ----------------------------------------------------------------------------------------------- |
| HP1 | 🟠 HIGH  | Banner imageDesktop/imageMobile приймає `javascript:`/`data:`/SSRF URLs без `isSafeUrl()` check |
| HP2 | 🟡 MED   | Reorder race на drag-drop — два admins одночасно — last-write-wins без merge                    |
| HP3 | 🟡 MED   | SEO_text block disabled у фронті (hardcoded null) — admin toggle нічого не дає                  |
| HP4 | 🟢 LOW   | Revalidate path не await'иться → silent failure                                                 |
| HP5 | 🟢 LOW   | Role: manager рівний admin'у — без distinction                                                  |
