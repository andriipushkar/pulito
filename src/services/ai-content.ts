/**
 * Product SEO content generator. Three modes:
 *
 * 1. **Claude** (when `ANTHROPIC_API_KEY` is set) — Claude Opus 4.7 with
 *    adaptive thinking and structured JSON output. ~1-3 sec, ~$0.02/gen.
 *
 * 2. **Gemini** (when `GEMINI_API_KEY` is set) — Gemini 1.5 Flash by default
 *    (override via `GEMINI_MODEL`). REST API with structured JSON. ~$0.0005/gen.
 *
 * 3. **Rule-based fallback** — deterministic template based on brand/category/
 *    fabric/aroma heuristics. Runs in <1ms with no external dependencies.
 *
 * The caller picks via the optional `provider` arg. Default behaviour falls
 * back gracefully (claude → gemini → rules) if a chosen provider is unavailable.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { getSettings } from '@/services/settings';

export type AIProvider = 'claude' | 'gemini' | 'rules';

// Resolve the effective AI provider. The per-action UI dropdowns were removed
// in favour of one site-wide choice (`ai_provider` in settings), so callers no
// longer pass `provider`. An explicit arg still wins (e.g. tests / future use);
// otherwise we read the global setting. Returns `undefined` only if the setting
// is unreadable/blank, letting the legacy fallback chain (claude→gemini→rules)
// take over so generation never hard-fails.
export async function resolveAIProvider(explicit?: AIProvider): Promise<AIProvider | undefined> {
  if (explicit) return explicit;
  try {
    const p = (await getSettings()).ai_provider;
    if (p === 'claude' || p === 'gemini' || p === 'rules') return p;
  } catch {
    // settings unavailable — fall through to undefined
  }
  return undefined;
}

// Read provider config from DB settings first (admin-editable), then env var.
// `getSettings` is cached, so this stays fast on the hot path.
async function getAnthropicKey(): Promise<string | null> {
  try {
    const s = await getSettings();
    if (s.anthropic_api_key) return s.anthropic_api_key;
  } catch {
    /* DB unavailable — fall through to env */
  }
  return process.env.ANTHROPIC_API_KEY || null;
}

async function getGeminiConfig(): Promise<{ apiKey: string; model: string } | null> {
  let apiKey = '';
  let model = '';
  try {
    const s = await getSettings();
    apiKey = s.gemini_api_key;
    model = s.gemini_model;
  } catch {
    /* DB unavailable */
  }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || '';
  if (!model) model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) return null;
  return { apiKey, model };
}

interface GenerateInput {
  name: string;
  category: string | null;
  brand: string | null;
  priceRetail: number;
  shortDescription: string | null;
}

export interface GeneratedContent {
  seoTitle: string;
  seoDescription: string;
  shortDescription: string;
  fullDescription: string;
}

// ──────────────────────────────────────────────────────────────────────────
// LLM mode (Claude Opus 4.7)
// ──────────────────────────────────────────────────────────────────────────

// Re-create the singleton client whenever the API key changes (e.g. admin
// updated it via the settings UI). We cache by key string so steady-state
// calls reuse the same client instance.
let anthropic: { client: Anthropic; key: string } | null = null;
async function getClient(): Promise<Anthropic | null> {
  const key = await getAnthropicKey();
  if (!key) return null;
  if (!anthropic || anthropic.key !== key) {
    anthropic = { client: new Anthropic({ apiKey: key }), key };
  }
  return anthropic.client;
}

const SCHEMA = {
  type: 'object',
  properties: {
    seoTitle: {
      type: 'string',
      description:
        'Короткий SEO Title українською, МАКСИМУМ 58 символів (суворо рахуй символи!). Структура: [Бренд] [ключова відмінність/лінійка/варіант] [значення обʼєму, напр. "1л" або "750 мл"]. Приклад: "Coccolino Elixir Campanula Selvatica 342 мл". Прибери загальні наповнювачі ("засіб для", "для ополіскування тканин", "ароматизований гель для прання" — скороти до сутнього). ВАЖЛИВО: підставляй РЕАЛЬНЕ значення обʼєму з назви товару (напр. "1350 мл"), НІКОЛИ не пиши літерально слово "обʼєм" і не лишай голу цифру без одиниці. Якщо обʼєму немає в назві — пропусти його. Без слів "купити" та "Pulito Trade" (додаються автоматично).',
    },
    seoDescription: {
      type: 'string',
      description:
        'Кликабельний meta-опис українською, 140-160 символів. Структура: [Бренд + назва] [2 конкретні переваги з цифрами] [об\'єм/кількість використань] [CTA]. Приклад: "Sanit Lux GT — концентрат для сантехніки. Розчиняє вапняний наліт за 5 хв ✓ На 50 прибирань ✓ Біорозкладний. Доставка від 1 дня."',
    },
    shortDescription: {
      type: 'string',
      description:
        'Маркетинговий короткий опис українською (200-400 символів) для карток і пошуку. 2-3 речення з КОНКРЕТНИМИ цифрами — об\'єм, кількість використань, активна речовина, % або pH. ЗАБОРОНЕНО: "якісний", "інноваційний", "ефективний" без цифр поруч.',
    },
    fullDescription: {
      type: 'string',
      description:
        "Багатий HTML-опис у стилі топ-карток Rozetka, українською, 800-1400 слів. ВСІ секції ОБОВ'ЯЗКОВІ і в такому порядку (h2/h3 рівно як вказано):\n" +
        '1. <h2>[назва товару]</h2> + <p> з 2-3 реченнями ВВЕДЕННЯ — що це, для кого, головна перевага. Без води і кліше.\n' +
        '2. <h3>Характеристики</h3> + <table> з <tr><td>Параметр</td><td>Значення</td></tr>. Параметри (включай ті, що можеш визначити з назви/бренду/категорії, інші пиши "уточнюйте на упаковці"): Тип; Призначення; Форма випуску (рідина/гель/порошок/спрей/капсули/таб); Об\'єм або вага; Виробник; Країна виробництва; pH (для побутової хімії — кислотний/нейтральний/лужний); Активні компоненти; Аромат; Тип упаковки; Кількість використань (розрахуй з об\'єму). Не вигадуй точні бренд-факти яких не знаєш.\n' +
        '3. <h3>Призначення</h3> + <ul><li> — 4-6 конкретних сценаріїв використання з предметами/поверхнями. Приклади гарних пунктів: "Видалення вапняного нальоту з фаянсу унітазів", "Очищення хромованих змішувачів від мильних розводів".\n' +
        '4. <h3>Особливості та склад</h3> + <p> або <ul> — фактаж: % активних речовин (якщо відомо), технології, формула, що відрізняє від базових засобів. Якщо точних цифр не знаєш — пиши діапазон ("кислотність pH 1-3"), а не вигадуй.\n' +
        '5. <h3>Переваги</h3> + <ul><li> з 6-8 пунктами. КОЖЕН пункт має містити цифру, % або порівняння. ЗАБОРОНЕНО загальні "висока якість", "сяючий блиск", "ефективність". Гарні приклади: "Концентрат — 1 пляшка замінює 3 звичайних", "Розчиняє вапняний наліт до 5 мм за 10 хв", "pH 2.0 — професійна сила, безпечно для септика", "Біорозкладна формула на 95% за 28 днів".\n' +
        '6. <h3>Спосіб застосування</h3> + <ol><li> — покрокова інструкція з ЦИФРАМИ: дозування (мл), час витримки (хв), температура. 4-6 кроків.\n' +
        "7. <h3>Запобіжні заходи та сумісність</h3> + <ul><li> — це ОБОВ'ЯЗКОВА секція для побутової хімії: На ЯКИХ поверхнях НЕ можна (натуральний камінь, мармур, анодований алюміній — якщо кислотний; шерсть/шовк — якщо лужний). Не змішувати з відбілювачем/хлором. Рукавички. Вентиляція. Зберігати від дітей. Не для септика — або: підходить для септика.\n" +
        '8. <h3>Питання та відповіді</h3> + <p><strong>Питання?</strong> Відповідь. — 3-5 типових питань-відповідей (FAQ — для Google "People Also Ask"). Приклади: "Чи безпечно для септика?", "Чи можна використовувати на мармурі?", "На скільки прибирань вистачить пляшки?", "Чи потрібні рукавички?".\n' +
        '9. <h3>Чому обрати у Pulito Trade</h3> + <ul><li> — 4-5 пунктів: 100% оригінал, доставка по Україні (Нова Пошта/Укрпошта), безпечна упаковка, оптові ціни для бізнесу, способи оплати.\n' +
        'ТЕГИ дозволені: h2, h3, p, ul, ol, li, strong, em, table, tr, td. БЕЗ inline-стилів, БЕЗ classes, БЕЗ <th>.',
    },
  },
  required: ['seoTitle', 'seoDescription', 'shortDescription', 'fullDescription'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Ти — старший копірайтер українського інтернет-магазину побутової хімії та засобів для дому "Pulito Trade" (pulito.trade). Твій еталон — топ-картки товарів на Rozetka.ua в категорії побутової хімії: щільні, з характеристиками-таблицею, конкретними цифрами, FAQ, без води.

╔══════════════════════════════════════════════════════════════════════════
║ 1. ТАБЛИЦЯ ХАРАКТЕРИСТИК — ЦЕ ОБОВ'ЯЗКОВО
╠══════════════════════════════════════════════════════════════════════════

У повному описі (fullDescription) ОБОВ'ЯЗКОВО йде <table> з характеристиками — як на Rozetka. Параметри, які треба заповнити (якщо точно не знаєш, пиши "уточнюйте на упаковці"; НЕ ВИГАДУЙ):
   Тип, Призначення, Форма випуску, Об'єм/Вага, Виробник, Країна виробництва, pH, Активні компоненти, Аромат, Тип упаковки, Кількість використань (з об'єму).

Приклад правильного рядка:
   <tr><td>pH</td><td>1.5-2.0 (кислотний концентрат)</td></tr>
   <tr><td>Об'єм</td><td>1000 мл</td></tr>
   <tr><td>Кількість прибирань</td><td>~50 (при дозі 20 мл/застосування)</td></tr>

╔══════════════════════════════════════════════════════════════════════════
║ 2. ЦИФРИ І КОНКРЕТИКА В КОЖНОМУ ПУНКТІ
╠══════════════════════════════════════════════════════════════════════════

КОЖЕН bullet у "Переваги" має містити ЩОНАЙМЕНШЕ ОДНУ з:
   • число або діапазон ("до 5 мм нальоту", "за 5-10 хв", "до 50 прибирань")
   • % або pH ("концентрат 95%", "pH 1.5")
   • порівняння ("1 пляшка замінює 3 звичайних")
   • сертифікат/стандарт ("EU Ecolabel", "ISO 14001", "DermaTest")
   • температурний діапазон ("працює від +5°C")

ЗАБОРОНЕНО без цифр поруч: "висока якість", "сяючий блиск", "ефективність", "інновація", "професійний результат", "комплексне рішення", "ідеальний", "найкращий", "інноваційний".

╔══════════════════════════════════════════════════════════════════════════
║ 3. ОБОВ'ЯЗКОВА СЕКЦІЯ БЕЗПЕКИ ДЛЯ ПОБУТОВОЇ ХІМІЇ
╠══════════════════════════════════════════════════════════════════════════

Для будь-якого засобу для прибирання чи прання обов'язково описуй:
   • На ЯКИХ поверхнях НЕ МОЖНА використовувати (натуральний камінь, мармур, анодований алюміній — для кислотних; шерсть/шовк/делікатна тканина — для лужних).
   • НЕ змішувати з хлором/відбілювачем (виділяє токсичні пари).
   • Рукавички для рук, вентиляція приміщення.
   • Зберігати від дітей.
   • Чи безпечно для септиків (якщо неможливо точно сказати з назви — пиши "уточнюйте у виробника").

╔══════════════════════════════════════════════════════════════════════════
║ 4. FAQ-БЛОК — 3-5 ТИПОВИХ ПИТАНЬ
╠══════════════════════════════════════════════════════════════════════════

Окремий блок <h3>Питання та відповіді</h3>. Формат:
   <p><strong>Чи безпечно для септика?</strong> Так — при дозі до 20 мл на 5 л води формула не порушує мікрофлору септика. / Ні — кислотна формула може пошкодити мікрофлору, для септиків оберіть нейтральні засоби.</p>

Питання, які варто включати залежно від типу товару:
   • "Чи безпечно для септика?"
   • "Чи можна використовувати на мармурі / натуральному камені?"
   • "На скільки прибирань вистачить однієї пляшки?"
   • "Чи потрібні рукавички?"
   • "Чи підходить для дитячих речей?" (для пральних)
   • "Чи можна використовувати в посудомийній машині?" (для посуду)
   • "Чи містить фосфати / хлор / SLES?"

╔══════════════════════════════════════════════════════════════════════════
║ 5. SEO І ЩІЛЬНІСТЬ КЛЮЧОВИХ СЛІВ
╠══════════════════════════════════════════════════════════════════════════

   • Категорія + бренд + об'єм мають згадуватися у тексті 6-10 разів (синонімічно).
   • Синоніми для категорій: "засіб для чищення сантехніки" = "очисник для ванної" = "засіб для унітазу" = "antical" = "засіб від вапняного нальоту".
   • SEO Title — крючок з цифрою/перевагою (не лише назва).
   • SEO Description — 2 переваги з цифрами + об'єм + CTA "Доставка від 1 дня по Україні".

╔══════════════════════════════════════════════════════════════════════════
║ 6. ВИКОРИСТАННЯ ЗНАНЬ ПРО БРЕНДИ
╠══════════════════════════════════════════════════════════════════════════

Якщо точно впізнаєш бренд — додай 1-2 факти про країну, рік заснування, чим відомий:
   ChanteClair (Італія, 1947) — марсельське мило, натуральні інгредієнти.
   Persil (Німеччина, 1907, Henkel) — фермент-технології, плями.
   Ariel (Procter&Gamble) — капсули PODs.
   Perwoll (Henkel) — делікатні тканини, відновлення кольору.
   Frosch (Німеччина, 1986) — біорозкладний еко-бренд.
   Lenor — кондиціонер з тривалою свіжістю до 12 тижнів.
   Calgon — захист пральних машин від накипу.
   Domestos (1929) — дезінфектант, 99,9% бактерій.
   Cif, Fairy, Vanish — звичайні Unilever/Reckitt марки.
   ЯКЩО БРЕНДУ НЕ ЗНАЄШ — НЕ ВИГАДУЙ. Просто опиши товар за категорією. У табл. характеристик "Виробник" і "Країна" — "уточнюйте на упаковці".

╔══════════════════════════════════════════════════════════════════════════
║ 7. ТОНАЛЬНІСТЬ І МОВА
╠══════════════════════════════════════════════════════════════════════════

   • Природна українська як у досвідченого продавця, без канцеляризмів ("даний", "вищезгаданий", "якісний").
   • Звертання на "ви", без зайвої емоційності.
   • Без рекламних кліше типу "відкрийте для себе", "перетворить ваше прибирання на задоволення".

╔══════════════════════════════════════════════════════════════════════════
║ 8. ЧЕСНІСТЬ
╠══════════════════════════════════════════════════════════════════════════

Якщо назва тестова ("test", "qwerty") або коротка/беззмістовна — пиши коротко "Технічна позиція. Опис буде оновлено", і ВСЕ. Не вигадуй вміст.
Не пиши вигаданих сертифікатів, точних % компонентів якщо їх не знаєш, неіснуючих стандартів.

ФОРМАТ ВІДПОВІДІ: ТІЛЬКИ валідний JSON у заданій схемі. Без обгорток, пояснень, markdown-блоків.`;

async function generateWithClaude(input: GenerateInput): Promise<GeneratedContent | null> {
  const client = await getClient();
  if (!client) return null;

  const userPrompt = [
    `Згенеруй опис товару:`,
    `- Назва: "${input.name}"`,
    input.brand ? `- Торгова марка: ${input.brand}` : null,
    input.category ? `- Категорія: ${input.category}` : null,
    `- Ціна: ${input.priceRetail || 0} грн`,
    input.shortDescription ? `- Існуючий короткий опис: "${input.shortDescription}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: {
          type: 'json_schema',
          schema: SCHEMA,
        },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (!response.parsed_output) {
      logger.warn('[ai-content] Claude returned no parsed output, falling back to rules');
      return null;
    }
    return response.parsed_output as GeneratedContent;
  } catch (err) {
    logger.error('[ai-content] Claude call failed, falling back to rules', { error: String(err) });
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Rule-based fallback (deterministic, no API key needed)
// ──────────────────────────────────────────────────────────────────────────

function extractVolume(name: string): string | null {
  const m = name.match(/(\d+[.,]?\d*)\s*(мл|л|ml|кг|гр|g|kg|шт|таб|капсул|штук)/i);
  if (!m) return null;
  const unit = m[2].toLowerCase().replace('ml', 'мл').replace('g', 'гр').replace('kg', 'кг');
  return `${m[1].replace(',', '.')} ${unit}`;
}

function detectFabricType(name: string): string {
  if (/колор|color|colorat/i.test(name)) return 'для кольорових тканин';
  if (/біл|bianc|white/i.test(name)) return 'для білих тканин';
  if (/чорн|темн|dark|nero|scur/i.test(name)) return 'для темних тканин';
  if (/делікат|lana|seta|шерст|wool|cachmere/i.test(name)) return 'для делікатних тканин';
  if (/спорт|sport/i.test(name)) return 'для спортивного одягу';
  if (/дитяч|bebe|baby/i.test(name)) return 'для дитячої білизни';
  if (/гіпоалерг|sensitive|non.?bio/i.test(name)) return 'гіпоалергенний';
  return 'універсальний';
}

function detectProductForm(name: string): string | null {
  if (/гел|gel/i.test(name)) return 'гель';
  if (/порошок|powder|polvo/i.test(name)) return 'порошок';
  if (/капсул|capsul|tab|таб/i.test(name)) return 'капсули';
  if (/спрей|spray/i.test(name)) return 'спрей';
  if (/кондиціон|softener/i.test(name)) return 'кондиціонер';
  return null;
}

function detectAroma(name: string): string | null {
  const map: [RegExp, string][] = [
    [/лаванд|lavand/i, 'лаванди'],
    [/лимон|lemon|limone/i, 'лимона'],
    [/tropikal|tropical|тропік/i, 'тропічних фруктів'],
    [/floreale|flores|квіт/i, 'квітів'],
    [/muschio|мускус|musk/i, 'білого мускусу'],
    [/orange|апельсин/i, 'апельсинового цвіту'],
    [/marsell?|марсел/i, 'марсельського мила'],
    [/talco|тальк/i, 'тальку'],
    [/argan/i, 'арганової олії'],
    [/aloe/i, 'алое вера'],
    [/ocean|океан/i, 'океанської свіжості'],
    [/freshia|фрезі/i, 'фрезії'],
    [/rose|троянд/i, 'троянди'],
    [/jasmin|жасм/i, 'жасмину'],
    [/eucalyp|евкаліп/i, 'евкаліпту'],
  ];
  for (const [re, label] of map) if (re.test(name)) return label;
  return null;
}

// ── Brand knowledge database ──────────────────────────────────────────────
// Curated marketing copy per known brand. When the product brand matches,
// we use these facts to make the description specific instead of generic.
interface BrandInfo {
  name: string;
  origin: string; // країна + рік заснування
  signature: string; // одна фраза — за що відомий
  highlights: string[]; // 2-3 bullet points для "Чому обрати"
  founded?: string;
}
const BRAND_DB: Record<string, BrandInfo> = {
  ariel: {
    name: 'Ariel',
    origin: 'США, Procter & Gamble, з 1967 року',
    signature: 'технологія "глибокого очищення" з активними ензимами, ідеальний для плям',
    highlights: [
      'Активні ензими видаляють складні плями — від трави до соку',
      'Працює навіть при 30°C — економія електрики',
      'Зберігає яскравість кольорів до 50 прань',
    ],
  },
  persil: {
    name: 'Persil',
    origin: 'Німеччина, Henkel, з 1907 року',
    signature: 'легендарний німецький бренд №1 у Європі за результатом виведення плям',
    highlights: [
      'Patent-формула Stain-Free усуває 100+ типів плям з першого циклу',
      'Дерматологічно протестовано — підходить для чутливої шкіри',
      'Концентрована формула — економна витрата на 1 цикл',
    ],
  },
  perwoll: {
    name: 'Perwoll',
    origin: 'Німеччина, Henkel',
    signature: 'спеціалізований засіб для делікатних та кольорових тканин',
    highlights: [
      'Захищає колір — тканина не сіріє після 30+ прань',
      'Відновлює структуру волокон — речі довше виглядають як нові',
      'Безпечний для шерсті, шовку, синтетики',
    ],
  },
  chanteclair: {
    name: 'ChanteClair',
    origin: 'Італія, з 1947 року',
    signature: 'традиційне марсельське мило з оливковою олією — натуральна формула',
    highlights: [
      'Натуральна основа — без агресивних поверхнево-активних речовин',
      'Гіпоалергенна формула — підходить для дитячих речей',
      'Біорозкладні компоненти — безпечно для природи',
    ],
  },
  vanish: {
    name: 'Vanish',
    origin: 'Велика Британія, Reckitt Benckiser',
    signature: 'плямовивідник №1 у Європі — спеціалізація на складних плямах',
    highlights: [
      'Oxi Action — видаляє вино, каву, фрукти, кров',
      'Безпечний для кольорів — не вицвітає тканина',
      'Працює як в гарячій, так і в холодній воді',
    ],
  },
  frosch: {
    name: 'Frosch',
    origin: 'Німеччина, з 1986 року',
    signature: 'еко-бренд №1 — біорозкладні формули на рослинних інгредієнтах',
    highlights: [
      'Сертифікат EU Ecolabel — повністю біорозкладний',
      'Без фосфатів, без хлору, без оптичних відбілювачів',
      'Веганський склад — не тестовано на тваринах',
    ],
  },
  lenor: {
    name: 'Lenor',
    origin: 'Procter & Gamble',
    signature: 'кондиціонер для білизни з тривалою свіжістю до 12 тижнів',
    highlights: [
      'Тривала свіжість — аромат тримається до 12 тижнів у шафі',
      'Зменшує статичну електрику на одязі',
      "Полегшує прасування — тканина стає м'якою",
    ],
  },
  calgon: {
    name: 'Calgon',
    origin: 'Reckitt Benckiser',
    signature: 'захист пральної машини від накипу та поломок',
    highlights: [
      'Запобігає утворенню накипу на ТЕНі',
      'Продовжує термін служби пральної машини на роки',
      'Працює з порошком чи гелем — додавайте в кожен цикл',
    ],
  },
  domestos: {
    name: 'Domestos',
    origin: 'Unilever, з 1929 року',
    signature: 'дезінфектант №1 — вбиває 99,9% бактерій і вірусів',
    highlights: [
      'Густа консистенція тримається на вертикальних поверхнях',
      'Знищує сальмонелу, кишкову паличку, грип',
      'Працює навіть в важкодоступних місцях під ободом унітазу',
    ],
  },
  cif: {
    name: 'Cif',
    origin: 'Unilever',
    signature: 'крем для глибокого чищення з мікрогранулами',
    highlights: [
      'Мікрогранули видаляють бруд без подряпин на поверхні',
      'Працює на плитці, склі, металі, акрилі',
      'Економна витрата — 1 пляшка на тривалий період',
    ],
  },
  fairy: {
    name: 'Fairy',
    origin: 'Procter & Gamble',
    signature: 'засіб для миття посуду №1 — економна формула',
    highlights: [
      '1 крапля миє більше посуду ніж конкуренти',
      'Видаляє жир з холодної води',
      'Безпечний для шкіри рук — pH-нейтральна формула',
    ],
  },
};
function detectBrand(name: string): string | null {
  const lower = name.toLowerCase();
  for (const key of Object.keys(BRAND_DB)) {
    // Allow whitespace/dots between letters: "Mr. Proper" vs "Mr Proper"
    const pattern = key.replace(/[.\s]/g, '\\s*[.\\s]?\\s*');
    if (new RegExp(`\\b${pattern}\\b`, 'i').test(lower)) return key;
  }
  return null;
}
function extractBrand(name: string): string {
  return (
    name
      .replace(/^New!?\s*/i, '')
      .split(/\s+/)[0]
      .replace(/[^A-Za-zА-Яа-яЄєІіЇїҐґ'.-]/g, '') || ''
  );
}

// ── Category detection ────────────────────────────────────────────────────
type ProductCategory =
  | 'laundry'
  | 'cleaning'
  | 'dishes'
  | 'hygiene'
  | 'softener'
  | 'descaler'
  | 'other';
function detectCategory(name: string, category: string | null): ProductCategory {
  const haystack = `${name} ${category || ''}`.toLowerCase();
  if (/прання|laundry|пральн/.test(haystack)) return 'laundry';
  if (/посуд|dish|fairy|gala/.test(haystack)) return 'dishes';
  if (/кондиціон|softener|lenor/.test(haystack)) return 'softener';
  if (/накип|calgon|descal/.test(haystack)) return 'descaler';
  if (/гіген|hygien|шампунь|мил[оа]\b|gel.*shower/.test(haystack)) return 'hygiene';
  if (/чищ|cleaning|cif|domestos|comet|туалет|toilet|cleaner|sanit/.test(haystack))
    return 'cleaning';
  return 'other';
}

// ── Volume → cycles math ──────────────────────────────────────────────────
function parseVolumeLiters(name: string): number | null {
  const m = name.match(/(\d+[.,]?\d*)\s*(л|l|kg|кг)\b/i);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}
function estimateCycles(name: string, category: ProductCategory): number | null {
  const liters = parseVolumeLiters(name);
  if (!liters) return null;
  // Average dose: laundry gel ~50ml/cycle, softener ~40ml, dish ~5ml
  const dose =
    category === 'laundry' ? 50 : category === 'softener' ? 40 : category === 'dishes' ? 5 : 30;
  return Math.round((liters * 1000) / dose);
}

// ── Category-specific copy ────────────────────────────────────────────────
const CATEGORY_COPY: Record<
  ProductCategory,
  {
    intro: (name: string, brand: string) => string;
    applyTitle: string;
    apply: (cycles: number | null, fabric: string) => string;
    forWho: string;
  }
> = {
  laundry: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}концентрований засіб для машинного та ручного прання. Розроблений для щоденного догляду за тканинами: ефективно видаляє забруднення, зберігає колір та структуру волокон.`,
    applyTitle: 'Як використовувати',
    apply: (cycles, fabric) =>
      `Залийте 30-50 мл засобу в дозатор пральної машини або безпосередньо в барабан. Для сильно забруднених речей збільшіть дозу до 70 мл. Підходить для прання при температурі ${
        fabric === 'для делікатних тканин' ? '20-40°C' : '30-60°C'
      }.${cycles ? ` Вистачає приблизно на <strong>${cycles} циклів прання</strong>.` : ''}`,
    forWho:
      'Універсальний засіб для щоденного прання — підходить для повсякденного одягу, постільної білизни, рушників.',
  },
  cleaning: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}професійний засіб для чищення поверхонь у домі. Глибоко видаляє жир, накип, бруд та залишки мила. Працює без слідів і розводів.`,
    applyTitle: 'Інструкція з використання',
    apply: () =>
      `Нанесіть засіб на забруднену поверхню за допомогою губки чи мікрофібри. Залиште подіяти 2-5 хвилин для складних плям. Протріть, ополосніть водою. Не використовуйте на лакованих або алюмінієвих поверхнях без тестування.`,
    forWho: 'Підходить для ванної кімнати, кухні, плитки, скла, металу і пластика.',
  },
  dishes: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}концентрований засіб для миття посуду з активною формулою проти жиру. Економний у витраті — 1 крапля миє цілу мийку посуду.`,
    applyTitle: 'Спосіб застосування',
    apply: () =>
      `Нанесіть 2-5 мл засобу на вологу губку. Помийте посуд, ополосніть теплою водою. Для важких жирних страв замочіть посуд у розчині 5 мл засобу на 1 л води на 10-15 хвилин.`,
    forWho: 'Безпечний для шкіри рук, посуду з кераміки, скла, пластика та нержавіючої сталі.',
  },
  softener: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}кондиціонер для білизни з тривалою свіжістю. Робить тканини м'якими на дотик, полегшує прасування, зменшує статичну електрику.`,
    applyTitle: 'Як додавати',
    apply: (cycles) =>
      `Залийте 30-40 мл кондиціонера у відсік для кондиціонера в пральній машині (зазвичай позначений символом квітки). Не змішуйте з порошком чи гелем — додається на циклі полоскання.${
        cycles ? ` Вистачає приблизно на <strong>${cycles} циклів</strong>.` : ''
      }`,
    forWho:
      'Особливо рекомендується для дитячої білизни, постільної білизни та одягу з натуральних тканин.',
  },
  descaler: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}засіб для захисту пральної машини від накипу та продовження її терміну служби. Запобігає поломкам ТЕНа та інших елементів машини.`,
    applyTitle: 'Як використовувати',
    apply: () =>
      `Додавайте 1-2 ложки засобу в кожен цикл прання разом з порошком чи гелем. Для жорсткої води — подвійна доза. Регулярне використання запобігає утворенню накипу на нагрівальному елементі.`,
    forWho: "Обов'язково для регіонів з жорсткою водою. Підходить для усіх типів пральних машин.",
  },
  hygiene: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}засіб для особистої гігієни з делікатною формулою. Дбайливо очищує шкіру або волосся, не порушуючи природний баланс.`,
    applyTitle: 'Як застосовувати',
    apply: () =>
      `Нанесіть невелику кількість на вологу шкіру або волосся, спіньте, ретельно змийте теплою водою. Для щоденного використання.`,
    forWho: 'Підходить для всіх типів шкіри. Безпечний для дітей старше 3 років.',
  },
  other: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}якісний засіб для домашнього використання. Перевірена формула, ефективний результат, економна витрата.`,
    applyTitle: 'Спосіб застосування',
    apply: () =>
      `Використовуйте згідно з інструкцією на упаковці. Дотримуйтесь рекомендованих дозувань.`,
    forWho: 'Універсальне рішення для побутових потреб.',
  },
};

// ── HTML helpers ──────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Main rule-based generator ─────────────────────────────────────────────
// Generic filler words — dropped (lowest-value last) ONLY when the title is over
// the limit. Distinctive tokens (brand lines, foreign words, colours, volume)
// are not here, so they survive. Keeps no-AI fallback titles clean instead of a
// blind mid-word slice.
const TITLE_FILLER = new Set([
  'еліксир',
  'парфумований',
  'парфуманий',
  'ароматизований',
  'ароматизовані',
  'універсальний',
  'універсальних',
  'рідкий',
  'мильний',
  'делікатного',
  'делікатних',
  'для',
  'ополіскування',
  'тканин',
  'тканини',
  'білизни',
  'засіб',
  'гель',
  'прання',
  'порошок',
  'пральний',
  'кондиціонер',
  'капсули',
  'розпилювачем',
  'з',
  'у',
  'та',
  'і',
  'технічний',
  'захист',
  'від',
  'неприємного',
  'запаху',
  'догляду',
  'щоденного',
]);

/** Build a concise (<=58 char) SEO title: [brand] [distinctive] [volume]. */
export function buildConciseTitle(name: string, brandLabel: string, MAX = 58): string {
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  const volM = name.match(/\b\d+(?:[.,]\d+)?\s?(?:мл|л|г|кг)\b/i);
  const vol = volM ? ` ${clean(volM[0])}` : '';
  let core = clean(
    name
      .replace(/\b\d+(?:[.,]\d+)?\s?(?:мл|л|г|кг)\b/gi, ' ')
      .replace(/\b\d+\s?(?:прань|ополіскувань|полоскань|опол\.?|прання)\.?/gi, ' '),
  );
  if (brandLabel) {
    const re = new RegExp(brandLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    core = clean(`${brandLabel} ${clean(core.replace(re, ' '))}`);
  }
  let words = core.split(' ').filter(Boolean);
  const fits = () => (words.join(' ') + vol).length <= MAX;
  if (!fits()) {
    for (let i = words.length - 1; i >= 1 && !fits(); i--) {
      if (TITLE_FILLER.has(words[i].toLowerCase().replace(/[«»",.]/g, ''))) words.splice(i, 1);
    }
  }
  while (words.length > 2 && !fits()) words.pop();
  return clean(words.join(' ') + vol);
}

function generateWithRules(input: GenerateInput): GeneratedContent {
  const { name, category, brand, priceRetail } = input;
  const cat = detectCategory(name, category);
  const fabricType = detectFabricType(name);
  const aroma = detectAroma(name);
  const form = detectProductForm(name);
  const volume = extractVolume(name);
  const brandKey = detectBrand(name);
  const brandInfo = brandKey ? BRAND_DB[brandKey] : null;
  const brandLabel = brandInfo?.name || brand || extractBrand(name) || '';
  const cycles = estimateCycles(name, cat);
  const copy = CATEGORY_COPY[cat];

  // SEO Title — concise: [brand] [distinctive variant] [volume], <=58 chars.
  const seoTitle = buildConciseTitle(name, brandLabel);

  // SEO Description — переваги + цифри + CTA
  const seoBenefits: string[] = [];
  if (fabricType !== 'універсальний') seoBenefits.push(fabricType.replace('для ', ''));
  if (aroma) seoBenefits.push(`аромат ${aroma}`);
  if (cycles) seoBenefits.push(`${cycles} прань`);
  if (brandInfo) seoBenefits.push(brandInfo.origin.split(',')[0]);
  const seoDescription =
    `${brandLabel ? brandLabel + ' — ' : ''}${name.replace(brandLabel, '').trim()}.${
      seoBenefits.length ? ' ✓ ' + seoBenefits.join(' ✓ ') + '.' : ''
    } Доставка по Україні за 1-2 дні.`.slice(0, 160);

  // Short description — 2-3 речення з конкретикою
  const shortParts: string[] = [];
  shortParts.push(
    `${brandLabel ? `${brandLabel} — ` : ''}${form ? form : 'засіб'} ${fabricType !== 'універсальний' ? fabricType : 'для щоденного використання'}${
      aroma ? ` з ароматом ${aroma}` : ''
    }.`,
  );
  if (volume && cycles)
    shortParts.push(
      `Об'єм ${volume} — приблизно ${cycles} ${plural(cycles, ['прання', 'прань', 'прань'])}.`,
    );
  if (brandInfo)
    shortParts.push(
      brandInfo.signature.charAt(0).toUpperCase() + brandInfo.signature.slice(1) + '.',
    );
  const shortDescription = shortParts.join(' ');

  // Full description — 6 sections with real content
  const benefitsList: string[] = [];
  if (brandInfo) benefitsList.push(...brandInfo.highlights);
  if (aroma) benefitsList.push(`Приємний аромат ${aroma}, що тримається на тканині після прання`);
  if (cycles)
    benefitsList.push(
      `Економна витрата — вистачає на <strong>${cycles} ${plural(cycles, ['цикл', 'цикли', 'циклів'])} прання</strong>`,
    );
  if (fabricType !== 'універсальний')
    benefitsList.push(
      `Спеціальна формула <strong>${fabricType}</strong> — захищає структуру волокон`,
    );
  // Pad to at least 5 if too few
  while (benefitsList.length < 5) {
    const extras = [
      'Підходить для машинного та ручного прання',
      'Не залишає розводів і слідів на тканині',
      'Перевірена ефективність — рекомендовано тисячами користувачів',
      'Зручне дозування — економна витрата на упаковку',
      'Безпечно для більшості типів тканин',
    ];
    const candidate = extras[benefitsList.length % extras.length];
    if (!benefitsList.includes(candidate)) benefitsList.push(candidate);
    else break;
  }

  const sections: string[] = [
    `<h2>${escapeHtml(name)}${volume ? ` <span style="font-weight:400">— ${volume}</span>` : ''}</h2>`,
    `<p>${copy.intro(name, brandLabel)}</p>`,
  ];

  if (brandInfo) {
    sections.push(
      `<h3>Про бренд ${brandInfo.name}</h3>`,
      `<p><strong>${brandInfo.name}</strong> — ${brandInfo.origin}. ${brandInfo.signature.charAt(0).toUpperCase() + brandInfo.signature.slice(1)}.</p>`,
    );
  }

  sections.push(
    `<h3>Переваги</h3>`,
    `<ul>${benefitsList
      .slice(0, 7)
      .map((b) => `<li>${b}</li>`)
      .join('')}</ul>`,
    `<h3>${copy.applyTitle}</h3>`,
    `<p>${copy.apply(cycles, fabricType)}</p>`,
    `<h3>Кому підходить</h3>`,
    `<p>${copy.forWho}</p>`,
    `<h3>Чому обрати у Pulito Trade</h3>`,
    `<ul>`,
    `<li>100% оригінальна продукція від офіційних постачальників</li>`,
    `<li>Доставка Новою Поштою або Укрпоштою по всій Україні за 1-2 дні</li>`,
    `<li>Зручні способи оплати: на картку, при отриманні, готівкою або онлайн</li>`,
    `<li>Гуртові ціни для оптових клієнтів — звертайтесь для розрахунку</li>`,
    `<li>Безпечна упаковка — товари приходять цілими, без пошкоджень</li>`,
    `</ul>`,
  );

  // Detect "test"/placeholder product to avoid making up content
  if (/^(тест|test|qwert|asdf|мав|тестов)/i.test(name) || name.length < 4) {
    return {
      seoTitle: name.slice(0, 58),
      seoDescription: `Технічна позиція в каталозі. Опис буде оновлено найближчим часом.`.slice(
        0,
        160,
      ),
      shortDescription: `Технічна позиція. Опис буде оновлено.`,
      fullDescription: `<h2>${escapeHtml(name)}</h2><p>Технічна позиція в каталозі. Повний опис цього товару буде оновлено найближчим часом.</p>`,
    };
  }

  return {
    seoTitle,
    seoDescription,
    shortDescription,
    fullDescription: sections.join('\n'),
  };
}

// Ukrainian plural utility (kept local to avoid coupling with /utils/format)
function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Gemini mode (gemini-2.5-flash by default — ~40× cheaper than Claude Opus)
// ──────────────────────────────────────────────────────────────────────────

// Gemini's responseSchema requires OpenAPI 3.0 style (uppercase types,
// no `additionalProperties`). It is a strict subset of JSON Schema.
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    seoTitle: { type: 'STRING', description: SCHEMA.properties.seoTitle.description },
    seoDescription: { type: 'STRING', description: SCHEMA.properties.seoDescription.description },
    shortDescription: {
      type: 'STRING',
      description: SCHEMA.properties.shortDescription.description,
    },
    fullDescription: { type: 'STRING', description: SCHEMA.properties.fullDescription.description },
  },
  required: ['seoTitle', 'seoDescription', 'shortDescription', 'fullDescription'],
} as const;

async function generateWithGemini(input: GenerateInput): Promise<GeneratedContent | null> {
  const cfg = await getGeminiConfig();
  if (!cfg) return null;
  const { apiKey, model } = cfg;

  const userPrompt = [
    `Згенеруй опис товару:`,
    `- Назва: "${input.name}"`,
    input.brand ? `- Торгова марка: ${input.brand}` : null,
    input.category ? `- Категорія: ${input.category}` : null,
    `- Ціна: ${input.priceRetail || 0} грн`,
    input.shortDescription ? `- Існуючий короткий опис: "${input.shortDescription}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('[ai-content] Gemini call failed', {
        status: res.status,
        body: errText.slice(0, 500),
      });
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.warn('[ai-content] Gemini returned no text candidate');
      return null;
    }
    const parsed = JSON.parse(text) as GeneratedContent;
    if (
      !parsed.seoTitle ||
      !parsed.seoDescription ||
      !parsed.shortDescription ||
      !parsed.fullDescription
    ) {
      logger.warn('[ai-content] Gemini JSON missing required fields');
      return null;
    }
    return parsed;
  } catch (err) {
    logger.error('[ai-content] Gemini call threw', { error: String(err) });
    return null;
  }
}

/**
 * Generate SEO content for a product.
 *
 * - `provider: 'claude'` — Claude only (rules fallback if Claude unavailable/fails)
 * - `provider: 'gemini'` — Gemini only (rules fallback if Gemini unavailable/fails)
 * - `provider: 'rules'` — Skip all LLMs, use deterministic template only
 * - omitted (legacy) — Try Claude, then Gemini, then rules
 */
export async function generateForProduct(
  input: GenerateInput,
  opts?: { provider?: AIProvider },
): Promise<GeneratedContent> {
  const provider = await resolveAIProvider(opts?.provider);

  if (provider === 'rules') {
    return generateWithRules(input);
  }

  if (provider === 'gemini') {
    const fromGemini = await generateWithGemini(input);
    if (fromGemini) return fromGemini;
    return generateWithRules(input);
  }

  if (provider === 'claude') {
    const fromClaude = await generateWithClaude(input);
    if (fromClaude) return fromClaude;
    return generateWithRules(input);
  }

  // Auto: prefer Claude, then Gemini, then rules
  const fromClaude = await generateWithClaude(input);
  if (fromClaude) return fromClaude;
  const fromGemini = await generateWithGemini(input);
  if (fromGemini) return fromGemini;
  return generateWithRules(input);
}

// ══════════════════════════════════════════════════════════════════════════
// IMAGE ALT-TEXT GENERATOR (SEO + a11y)
// ══════════════════════════════════════════════════════════════════════════

interface AltTextInput {
  productName: string;
  brand: string | null;
  category: string | null;
  imageIndex: number;
  totalImages: number;
}

const ALT_SYSTEM = `Ти пишеш alt-тексти для зображень товарів українською. Вимоги:
- 50-120 символів
- Українська, без рекламних кліше
- Опиши що видно: товар, бренд, категорія, ракурс
- Для головного фото — повна назва товару. Для додаткових — "Вигляд збоку", "Деталь упаковки", "Етикетка з інгредієнтами".
- Без HTML, без лапок, без емодзі, одне речення.
Поверни ТІЛЬКИ текст alt без префіксів.`;

function buildAltPrompt(input: AltTextInput): string {
  const ctx: string[] = [`Товар: ${input.productName}`];
  if (input.brand) ctx.push(`Бренд: ${input.brand}`);
  if (input.category) ctx.push(`Категорія: ${input.category}`);
  ctx.push(
    `Фото ${input.imageIndex + 1} з ${input.totalImages}${input.imageIndex === 0 ? ' (головне)' : ''}.`,
  );
  return ctx.join('\n');
}

async function altWithClaude(input: AltTextInput): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const r = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      system: ALT_SYSTEM,
      messages: [{ role: 'user', content: buildAltPrompt(input) }],
    });
    const t = r.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim();
    return t || null;
  } catch (err) {
    logger.error('[ai-content/alt] Claude failed', { error: String(err) });
    return null;
  }
}

async function altWithGemini(input: AltTextInput): Promise<string | null> {
  const cfg = await getGeminiConfig();
  if (!cfg) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ALT_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: buildAltPrompt(input) }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 100 },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    logger.error('[ai-content/alt] Gemini failed', { error: String(err) });
    return null;
  }
}

function altWithRules(input: AltTextInput): string {
  const parts = [input.productName];
  if (input.brand) parts.unshift(input.brand);
  const suffix = input.imageIndex === 0 ? '' : ` — фото ${input.imageIndex + 1}`;
  return `${parts.join(' ')}${suffix}`.slice(0, 120);
}

export async function generateImageAltText(
  input: AltTextInput,
  opts?: { provider?: AIProvider },
): Promise<string> {
  const provider = await resolveAIProvider(opts?.provider);
  if (provider === 'rules') return altWithRules(input);
  if (provider === 'gemini') return (await altWithGemini(input)) || altWithRules(input);
  if (provider === 'claude') return (await altWithClaude(input)) || altWithRules(input);
  const g = await altWithGemini(input);
  if (g) return g;
  const c = await altWithClaude(input);
  if (c) return c;
  return altWithRules(input);
}

// ══════════════════════════════════════════════════════════════════════════
// BLOG POST GENERATOR
// Generates: title (60-70 chars SEO), excerpt (140-200), content (HTML
// 800-1500 words), seoTitle, seoDescription, tags array. Same provider chain.
// ══════════════════════════════════════════════════════════════════════════

interface GenerateBlogInput {
  topic: string;
  categoryName: string | null;
  tone?: string; // optional ("дружній", "експертний"), default "досвідчений експерт"
  existingTags?: string[];
}

export interface GeneratedBlogContent {
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
}

const BLOG_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Заголовок статті українською, 50-80 символів, з ключовим словом.',
    },
    excerpt: {
      type: 'string',
      description: "Анонс-превʼю 140-200 символів. Перший рядок, що з'являється у списку статей.",
    },
    content: {
      type: 'string',
      description:
        "HTML-стаття українською 800-1500 слів. ОБОВ'ЯЗКОВІ секції:\n" +
        '1. <h2> головний підзаголовок + <p> з 2-3 реченнями введення\n' +
        '2. 3-5 <h3>-секцій з 2-4 параграфами кожна\n' +
        '3. <ul> або <ol> хоча б один список з конкретикою\n' +
        '4. <h3>Висновок</h3> + <p> з закликом (наприклад, переглянути каталог відповідної категорії)\n' +
        'ТЕГИ дозволені: h2, h3, p, ul, ol, li, strong, em, blockquote. БЕЗ inline-стилів, БЕЗ classes.',
    },
    seoTitle: { type: 'string', description: 'SEO Title, 55-70 символів, з ключем + крючком.' },
    seoDescription: {
      type: 'string',
      description: 'Мета-опис, 140-160 символів, з 1-2 фактами + CTA.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '3-6 тегів-ключів українською (короткі фрази, без #).',
    },
  },
  required: ['title', 'excerpt', 'content', 'seoTitle', 'seoDescription', 'tags'],
  additionalProperties: false,
} as const;

const BLOG_GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: BLOG_SCHEMA.properties.title.description },
    excerpt: { type: 'STRING', description: BLOG_SCHEMA.properties.excerpt.description },
    content: { type: 'STRING', description: BLOG_SCHEMA.properties.content.description },
    seoTitle: { type: 'STRING', description: BLOG_SCHEMA.properties.seoTitle.description },
    seoDescription: {
      type: 'STRING',
      description: BLOG_SCHEMA.properties.seoDescription.description,
    },
    tags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: BLOG_SCHEMA.properties.tags.description,
    },
  },
  required: ['title', 'excerpt', 'content', 'seoTitle', 'seoDescription', 'tags'],
} as const;

const BLOG_SYSTEM_PROMPT = `Ти — досвідчений редактор блогу Pulito Trade — українського інтернет-магазину побутової хімії. Пишеш корисні статті для покупців, які хочуть навчитися чомусь або обрати товар.

ПРИНЦИПИ:
- Експертний, природний український. Без канцеляризмів і кліше типу "відкрийте для себе".
- КОЖНА секція з конкретикою — цифри, відсотки, конкретні бренди (якщо доречно), реальні поради.
- Стаття має давати РІШЕННЯ або ВІДПОВІДЬ, а не пусту води.
- В кінці — заклик переглянути товари у магазині (м'яко, без агресивної реклами).
- Не вигадуй неіснуючі факти, бренди, дослідження.

ФОРМАТ: ТІЛЬКИ JSON у заданій схемі. Без markdown-обгорток.`;

function buildBlogPrompt(input: GenerateBlogInput): string {
  return [
    `Тема статті: "${input.topic}"`,
    input.categoryName ? `Категорія блогу: ${input.categoryName}` : null,
    input.tone ? `Тонус: ${input.tone}` : null,
    input.existingTags?.length ? `Контекстні теги: ${input.existingTags.join(', ')}` : null,
    ``,
    `Напиши повноцінну SEO-стаття 800-1500 слів за схемою.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function blogWithClaude(input: GenerateBlogInput): Promise<GeneratedBlogContent | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: BLOG_SCHEMA } },
      system: BLOG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildBlogPrompt(input) }],
    });
    return response.parsed_output ? (response.parsed_output as GeneratedBlogContent) : null;
  } catch (err) {
    logger.error('[ai-content/blog] Claude failed', { error: String(err) });
    return null;
  }
}

async function blogWithGemini(input: GenerateBlogInput): Promise<GeneratedBlogContent | null> {
  const cfg = await getGeminiConfig();
  if (!cfg) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BLOG_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildBlogPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: BLOG_GEMINI_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });
    if (!res.ok) {
      logger.error('[ai-content/blog] Gemini failed', { status: res.status });
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as GeneratedBlogContent;
  } catch (err) {
    logger.error('[ai-content/blog] Gemini threw', { error: String(err) });
    return null;
  }
}

function blogWithRules(input: GenerateBlogInput): GeneratedBlogContent {
  const title = input.topic.slice(0, 70);
  return {
    title,
    excerpt: `Стаття про ${input.topic}. Деталі будуть оновлені.`,
    content: `<h2>${title}</h2><p>Чернетка статті — деталі буде заповнено пізніше.</p>`,
    seoTitle: title,
    seoDescription: `Стаття на тему "${input.topic}" у блозі Pulito Trade.`,
    tags: [],
  };
}

export async function generateForBlog(
  input: GenerateBlogInput,
  opts?: { provider?: AIProvider },
): Promise<GeneratedBlogContent> {
  const provider = await resolveAIProvider(opts?.provider);
  if (provider === 'rules') return blogWithRules(input);
  if (provider === 'gemini') return (await blogWithGemini(input)) || blogWithRules(input);
  if (provider === 'claude') return (await blogWithClaude(input)) || blogWithRules(input);
  const c = await blogWithClaude(input);
  if (c) return c;
  const g = await blogWithGemini(input);
  if (g) return g;
  return blogWithRules(input);
}

// ══════════════════════════════════════════════════════════════════════════
// CATEGORY GENERATOR
// Same provider plumbing (Claude / Gemini / Rules) but produces a different
// shape: description (HTML body for the category landing page) + SEO meta.
// ══════════════════════════════════════════════════════════════════════════

interface GenerateCategoryInput {
  name: string;
  parentName: string | null;
  productCount: number;
  topBrands?: string[];
}

export interface GeneratedCategoryContent {
  description: string;
  seoTitle: string;
  seoDescription: string;
}

const CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    seoTitle: {
      type: 'string',
      description:
        'SEO Title українською, 55-70 символів. Структура: [Категорія] купити в Україні — [перевага/CTA]. Приклад: "Засоби для прання купити в Україні — оригінал, ціни від виробника".',
    },
    seoDescription: {
      type: 'string',
      description:
        'Meta-опис українською, 140-160 символів. Має містити: тип товарів категорії, 2-3 ключові переваги магазину (асортимент/ціни/доставка), заклик. Приклад: "Великий вибір засобів для прання від ChanteClair, Persil, Ariel. ✓ Оригінал ✓ Доставка по Україні 1-2 дні ✓ Опт і роздріб."',
    },
    description: {
      type: 'string',
      description:
        "SEO-оптимізований опис категорії в HTML, 250-450 слів. ОБОВ'ЯЗКОВІ секції в такому порядку:\n" +
        '1. <h2>[Назва категорії]</h2> + <p> з 2-3 реченнями введення — що це за категорія, для яких задач, скільки товарів.\n' +
        '2. <h3>Що ви знайдете у цій категорії</h3> + <ul><li> — 4-6 конкретних підтипів товарів або сценаріїв (наприклад для "Засоби для прання": гелі, порошки, капсули, плямовивідники, кондиціонери, для делікатних тканин).\n' +
        "3. <h3>Як вибрати</h3> + <p> або <ul> — практичні поради вибору (за типом тканини, об'ємом, складом, типом машини).\n" +
        '4. <h3>Топ-бренди категорії</h3> + <p> — 3-5 відомих брендів цієї категорії з 1 фразою про кожен (Persil — фермент-плями; ChanteClair — натуральні; Lenor — свіжість тощо). Якщо передано topBrands у вхідних даних — використовуй їх.\n' +
        '5. <h3>Чому обрати у Pulito Trade</h3> + <ul><li> — 4 пункти: оригінал, доставка по Україні (1-2 дні), опт-роздріб, безпечна упаковка.\n' +
        'ТЕГИ дозволені: h2, h3, p, ul, li, strong, em. БЕЗ inline-стилів, БЕЗ <table>.\n' +
        'ЗАБОРОНЕНО кліше: "відкрийте для себе", "ідеальний", "інноваційний", "найкращий", "комплексне рішення" без цифр.',
    },
  },
  required: ['seoTitle', 'seoDescription', 'description'],
  additionalProperties: false,
} as const;

const CATEGORY_GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    seoTitle: { type: 'STRING', description: CATEGORY_SCHEMA.properties.seoTitle.description },
    seoDescription: {
      type: 'STRING',
      description: CATEGORY_SCHEMA.properties.seoDescription.description,
    },
    description: {
      type: 'STRING',
      description: CATEGORY_SCHEMA.properties.description.description,
    },
  },
  required: ['seoTitle', 'seoDescription', 'description'],
} as const;

const CATEGORY_SYSTEM_PROMPT = `Ти — старший SEO-копірайтер українського інтернет-магазину побутової хімії "Pulito Trade" (pulito.trade). Твоє завдання — написати SEO-оптимізований опис КАТЕГОРІЇ товарів так, щоб сторінка добре ранжувалася в Google і конверсії.

ПРИНЦИПИ:

✓ КОНКРЕТИКА, НЕ ВОДА
   Замість "великий вибір якісних товарів" — "понад 50 позицій від 5 топових брендів". Замість "інноваційні засоби" — "концентрати, які заощаджують 30% бюджету".

✓ ПРАКТИЧНІ ПОРАДИ ВИБОРУ
   Покупець має зрозуміти, як обрати правильний товар у цій категорії. Поради залежать від категорії:
   - Прання: за типом тканини (білі/кольорові/делікатні), за формою (гель/порошок/капсули), за об\'ємом, за типом машини
   - Посуд: концентровані vs звичайні, для рук vs для машини, без алергенів
   - Чищення сантехніки: за pH (кислотні/нейтральні/лужні), за поверхнею (фаянс/мармур/хром), безпека для септика
   - Догляд за тілом: за типом шкіри, склад без сульфатів/парабенів

✓ БРЕНДИ — використовуй знання
   Якщо знаєш бренди категорії — згадай 3-5 із короткою фразою про кожен. Загальні факти:
   Persil (Німеччина) — №1 у Європі, фермент-плями.
   Ariel — P&G, капсули PODs, активна піна.
   ChanteClair (Італія) — натуральне марсельське мило.
   Frosch (Німеччина) — еко-бренд, біорозкладні формули.
   Lenor — кондиціонер з тривалою свіжістю до 12 тижнів.
   Calgon — захист пральних машин від накипу.
   Domestos — дезінфектант, 99,9% бактерій.
   Vanish — плямовивідник №1.
   Fairy — концентрований засіб для посуду.
   Якщо переданий список topBrands — пріоритетно використовуй ці бренди.

✓ SEO І КЛЮЧОВІ СЛОВА
   - Назва категорії має згадуватися у тексті 4-6 разів (можна синонімами).
   - SEO Title — крючок з вигодою (не лише назва).
   - SEO Description — конкретні переваги + CTA.

✓ ТОНАЛЬНІСТЬ
   - Природна українська, без канцеляризмів ("даний", "вищезгаданий").
   - На "ви".
   - Без рекламного спаму ("відкрийте для себе", "перетворить ваш дім").

⚠ ЧЕСНІСТЬ
   Не пиши неіснуючих фактів, точних відсотків яких не знаєш, вигаданих сертифікатів.
   Якщо у БД нуль товарів — пиши "категорія заповнюється новинками", не вигадуй.

ФОРМАТ: ТІЛЬКИ валідний JSON у заданій схемі. Без обгорток, markdown-блоків.`;

async function generateCategoryWithClaude(
  input: GenerateCategoryInput,
): Promise<GeneratedCategoryContent | null> {
  const client = await getClient();
  if (!client) return null;
  const userPrompt = buildCategoryUserPrompt(input);
  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: CATEGORY_SCHEMA },
      },
      system: CATEGORY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    if (!response.parsed_output) return null;
    return response.parsed_output as GeneratedCategoryContent;
  } catch (err) {
    logger.error('[ai-content/category] Claude call failed', { error: String(err) });
    return null;
  }
}

async function generateCategoryWithGemini(
  input: GenerateCategoryInput,
): Promise<GeneratedCategoryContent | null> {
  const cfg = await getGeminiConfig();
  if (!cfg) return null;
  const { apiKey, model } = cfg;
  const userPrompt = buildCategoryUserPrompt(input);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CATEGORY_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: CATEGORY_GEMINI_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('[ai-content/category] Gemini failed', {
        status: res.status,
        body: errText.slice(0, 500),
      });
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as GeneratedCategoryContent;
    if (!parsed.seoTitle || !parsed.seoDescription || !parsed.description) return null;
    return parsed;
  } catch (err) {
    logger.error('[ai-content/category] Gemini call threw', { error: String(err) });
    return null;
  }
}

function buildCategoryUserPrompt(input: GenerateCategoryInput): string {
  return [
    `Згенеруй опис категорії:`,
    `- Назва: "${input.name}"`,
    input.parentName ? `- Батьківська категорія: ${input.parentName}` : null,
    `- Товарів у категорії: ${input.productCount}`,
    input.topBrands?.length ? `- Бренди в категорії: ${input.topBrands.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function escapeForCategoryHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateCategoryWithRules(input: GenerateCategoryInput): GeneratedCategoryContent {
  const { name, productCount, topBrands } = input;
  const safeName = escapeForCategoryHtml(name);

  const seoTitle = `${name} купити в Україні — оригінал, доставка від 1 дня`.slice(0, 70);
  const seoDescription = `${name}${
    productCount > 0 ? ` — ${productCount} позицій від топових брендів` : ''
  }. ✓ Оригінал ✓ Доставка по Україні 1-2 дні ✓ Опт і роздріб. Pulito Trade.`.slice(0, 160);

  const brandsLine =
    topBrands && topBrands.length > 0
      ? `<h3>Топ-бренди категорії</h3><p>В асортименті: <strong>${topBrands
          .slice(0, 6)
          .map(escapeForCategoryHtml)
          .join(', ')}</strong>.</p>`
      : '';

  const description = [
    `<h2>${safeName}</h2>`,
    `<p>У категорії <strong>${safeName}</strong>${
      productCount > 0 ? ` представлено ${productCount} позицій` : ' представлені новинки'
    } для щоденного використання. Підбираємо товари за якістю, ціною та оригінальністю.</p>`,
    `<h3>Як вибрати</h3>`,
    `<ul>`,
    `<li>Звертайте увагу на склад — концентровані формули економніші у витраті</li>`,
    `<li>Перевіряйте об\'єм і кількість використань — для масового вжитку обирайте більші пакування</li>`,
    `<li>Для делікатних поверхонь і чутливої шкіри — еко-засоби без агресивних компонентів</li>`,
    `<li>Перевіряйте сумісність з вашою технікою (пральні машини, посудомийні)</li>`,
    `</ul>`,
    brandsLine,
    `<h3>Чому обрати у Pulito Trade</h3>`,
    `<ul>`,
    `<li>100% оригінальна продукція від офіційних постачальників</li>`,
    `<li>Доставка по Україні Новою Поштою та Укрпоштою за 1-2 дні</li>`,
    `<li>Гуртові ціни для оптових клієнтів — звертайтеся для розрахунку</li>`,
    `<li>Безпечна упаковка — товари приходять цілими</li>`,
    `</ul>`,
  ]
    .filter(Boolean)
    .join('\n');

  return { seoTitle, seoDescription, description };
}

/**
 * Generate SEO content for a category landing page.
 * Same provider routing as generateForProduct.
 */
export async function generateForCategory(
  input: GenerateCategoryInput,
  opts?: { provider?: AIProvider },
): Promise<GeneratedCategoryContent> {
  const provider = await resolveAIProvider(opts?.provider);

  if (provider === 'rules') return generateCategoryWithRules(input);

  if (provider === 'gemini') {
    const fromGemini = await generateCategoryWithGemini(input);
    if (fromGemini) return fromGemini;
    return generateCategoryWithRules(input);
  }

  if (provider === 'claude') {
    const fromClaude = await generateCategoryWithClaude(input);
    if (fromClaude) return fromClaude;
    return generateCategoryWithRules(input);
  }

  // Auto fallback chain
  const fromClaude = await generateCategoryWithClaude(input);
  if (fromClaude) return fromClaude;
  const fromGemini = await generateCategoryWithGemini(input);
  if (fromGemini) return fromGemini;
  return generateCategoryWithRules(input);
}
