/**
 * Product SEO content generator. Two modes:
 *
 * 1. **LLM mode** (preferred when `ANTHROPIC_API_KEY` is set) — calls Claude
 *    Opus 4.7 with adaptive thinking and structured JSON output. Produces
 *    natural, brand-specific copy. ~1-3 sec, ~$0.02 per generation.
 *
 * 2. **Rule-based fallback** — deterministic template based on brand/category/
 *    fabric/aroma heuristics. Runs in <1ms with no external dependencies.
 *
 * Both paths return the same `GeneratedContent` shape, so the API route and
 * the admin UI need no changes when toggling between them.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

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

/** Singleton client — created on first use only if API key is present */
let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

const SCHEMA = {
  type: 'object',
  properties: {
    seoTitle: {
      type: 'string',
      description:
        'Магнітний SEO Title українською, 55-70 символів. Структура: [Бренд] [Назва] [об\'єм] — [ключова перевага]. Приклади: "ChanteClair Гель для прання Марсельське мило 1.5л — ніжний догляд". Без слів "купити в Pulito Trade" (вони додаються автоматично).',
    },
    seoDescription: {
      type: 'string',
      description:
        'Кликабельний meta-опис українською, 140-160 символів. Має містити: 2 переваги, об\'єм/кількість прань, заклик до дії. Приклад: "Натуральний гель ChanteClair з оливковою олією. До 25 прань ✓ Бережний до тканин ✓ Без фосфатів. Доставка по Україні за 1-2 дні."',
    },
    shortDescription: {
      type: 'string',
      description:
        'Маркетинговий короткий опис українською (200-400 символів) для карток і пошуку. 2-3 речення з конкретними перевагами товару — не загальні фрази.',
    },
    fullDescription: {
      type: 'string',
      description:
        'Повний HTML-опис українською (600-1200 слів). ОБОВ\'ЯЗКОВІ секції в такому порядку:\n' +
        '1. <h2> з назвою товару + <p> з 2-3 реченнями ВВЕДЕННЯ — що це і для кого\n' +
        '2. <h3>Особливості та склад</h3> + <p> або <ul> — конкретні інгредієнти, технології, що відрізняє цей бренд (можна використовувати загальні знання про бренд)\n' +
        '3. <h3>Переваги</h3> + <ul><li> з 5-7 пунктами — НЕ загальні («якість, доставка»), а конкретні («ефективний при низьких температурах 30°C», «економний — 30мл на цикл», «біорозкладний», «гіпоалергенний» тощо)\n' +
        '4. <h3>Спосіб застосування</h3> + <p> — як правильно використовувати (дозування, температура, особливості)\n' +
        '5. <h3>Для яких тканин підходить</h3> або <h3>Для якого типу прибирання</h3> + <p>\n' +
        '6. <h3>Чому обрати у Pulito Trade</h3> + <ul><li> — наша доставка, оригінал, опт-роздріб тощо\n' +
        'ТЕГИ дозволені: h2, h3, p, ul, li, strong, em. БЕЗ inline-стилів.',
    },
  },
  required: ['seoTitle', 'seoDescription', 'shortDescription', 'fullDescription'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Ти — досвідчений копірайтер українського інтернет-магазину побутової хімії та засобів для дому "Pulito Trade" (pulito.trade). Пишеш ПРОДАЮЧІ описи товарів — детальні, корисні, з конкретикою.

ТВОЇ ПРИНЦИПИ:

✓ ПИШИ ДЕТАЛЬНО ТА ПЕРЕКОНЛИВО
   Покупець має зрозуміти: чим це краще за конкурентів, кому підходить, як працює. Уникай 1-2 реченнєвих відписок.

✓ ВИКОРИСТОВУЙ ЗНАННЯ ПРО БРЕНД
   Ariel, Persil, Perwoll, ChanteClair, Sole, Frosch, Vanish, Calgon, Lenor, Domestos, Cif, Mr.Proper, Tide, Ecover, Sano, Almawin, Sorti, Gala, Bingo — про ці бренди можна використовувати загальні знання (країна походження, тип формули, технології, чим відомі).
   ChanteClair — італійський бренд, традиційне марсельське мило, натуральні інгредієнти.
   Persil — німецький, традиція з 1907, фермент-технології, плями.
   Ariel — Procter&Gamble, відомий капсулами PODs, активна піна.
   Perwoll — для делікатних тканин, відновлення кольору, ароматизатори.
   Frosch — eco-бренд з Німеччини, біорозкладні формули.
   Lenor — кондиціонери з тривалою свіжістю.

✓ ВЕБ-СТАНДАРТИ SEO
   - SEO Title має мати магнітний "крючок" — не лише назву, а й вигоду
   - SEO Description має закликати клікнути: переваги + цифри + CTA
   - В описі — синонімічно повторюй ключове слово (категорія + бренд + об'єм)
   - Списки <ul><li> — Google любить структурований контент

✓ ЦИФРИ І КОНКРЕТИКА
   - "до 25 прань", "30°C — 60°C", "30мл на цикл", "при концентрації 50%", "об'єм 1.5л"
   - Якщо в назві є об'єм (1.5л, 5кг) — обов'язково згадуй кількість циклів/доз: для гелю 1.5л це приблизно 30 прань (15-50мл на цикл).

✓ УНІКАЛЬНА ЦІННІСНА ПРОПОЗИЦІЯ
   В секції "Переваги" — НЕ "якість, доставка", а конкретні фішки: гіпоалергенний, без сульфатів, кольори не вицвітають, працює в холодній воді, біорозкладний, концентрат (1 пляшка = 3 звичайних), сертифіковано (Ecolabel, DermaTest), без міклоплосок.

⚠ ЧЕСНІСТЬ
   Якщо назва товару тестова ("Тестовий товар", "qwerty", беззмістовна) — пиши коротко і чесно "Технічна позиція. Опис буде оновлено".
   Не вигадуй СПЕЦИФІКУ якої точно нема (точні склад-молекули, точні сертифікати, точні дати).

✓ ТОНАЛЬНІСТЬ
   - Українська мова, природна, як говорить досвідчений продавець
   - НЕ канцеляризми: "даний", "якісний", "вищезгаданий"
   - Використовуй порівняння: "як", "у відмінність від", "на відміну від звичайних"
   - Емоції: "ваш одяг", "сім'я", "чисте і свіже", "довіра"

ФОРМАТ: Поверни ТІЛЬКИ валідний JSON у заданій схемі. Без обгорток, пояснень, тегів коду.`;

async function generateWithClaude(input: GenerateInput): Promise<GeneratedContent | null> {
  const client = getClient();
  if (!client) return null;

  const userPrompt = [
    `Згенеруй опис товару:`,
    `- Назва: "${input.name}"`,
    input.brand ? `- Виробник: ${input.brand}` : null,
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
      'Полегшує прасування — тканина стає м\'якою',
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
type ProductCategory = 'laundry' | 'cleaning' | 'dishes' | 'hygiene' | 'softener' | 'descaler' | 'other';
function detectCategory(name: string, category: string | null): ProductCategory {
  const haystack = `${name} ${category || ''}`.toLowerCase();
  if (/прання|laundry|пральн/.test(haystack)) return 'laundry';
  if (/посуд|dish|fairy|gala/.test(haystack)) return 'dishes';
  if (/кондиціон|softener|lenor/.test(haystack)) return 'softener';
  if (/накип|calgon|descal/.test(haystack)) return 'descaler';
  if (/гіген|hygien|шампунь|мил[оа]\b|gel.*shower/.test(haystack)) return 'hygiene';
  if (/чищ|cleaning|cif|domestos|comet|туалет|toilet|cleaner|sanit/.test(haystack)) return 'cleaning';
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
  const dose = category === 'laundry' ? 50 : category === 'softener' ? 40 : category === 'dishes' ? 5 : 30;
  return Math.round((liters * 1000) / dose);
}

// ── Category-specific copy ────────────────────────────────────────────────
const CATEGORY_COPY: Record<ProductCategory, {
  intro: (name: string, brand: string) => string;
  applyTitle: string;
  apply: (cycles: number | null, fabric: string) => string;
  forWho: string;
}> = {
  laundry: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}концентрований засіб для машинного та ручного прання. Розроблений для щоденного догляду за тканинами: ефективно видаляє забруднення, зберігає колір та структуру волокон.`,
    applyTitle: 'Як використовувати',
    apply: (cycles, fabric) =>
      `Залийте 30-50 мл засобу в дозатор пральної машини або безпосередньо в барабан. Для сильно забруднених речей збільшіть дозу до 70 мл. Підходить для прання при температурі ${
        fabric === 'для делікатних тканин' ? '20-40°C' : '30-60°C'
      }.${cycles ? ` Вистачає приблизно на <strong>${cycles} циклів прання</strong>.` : ''}`,
    forWho: 'Універсальний засіб для щоденного прання — підходить для повсякденного одягу, постільної білизни, рушників.',
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
    forWho: 'Особливо рекомендується для дитячої білизни, постільної білизни та одягу з натуральних тканин.',
  },
  descaler: {
    intro: (n, b) =>
      `${b ? `<strong>${b}</strong> — ` : ''}засіб для захисту пральної машини від накипу та продовження її терміну служби. Запобігає поломкам ТЕНа та інших елементів машини.`,
    applyTitle: 'Як використовувати',
    apply: () =>
      `Додавайте 1-2 ложки засобу в кожен цикл прання разом з порошком чи гелем. Для жорсткої води — подвійна доза. Регулярне використання запобігає утворенню накипу на нагрівальному елементі.`,
    forWho: 'Обов\'язково для регіонів з жорсткою водою. Підходить для усіх типів пральних машин.',
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
    apply: () => `Використовуйте згідно з інструкцією на упаковці. Дотримуйтесь рекомендованих дозувань.`,
    forWho: 'Універсальне рішення для побутових потреб.',
  },
};

// ── HTML helpers ──────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Main rule-based generator ─────────────────────────────────────────────
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

  // SEO Title — магнітний з конкретною перевагою
  const benefit = (() => {
    if (cycles) return `до ${cycles} прань`;
    if (volume) return `об'єм ${volume}`;
    if (brandInfo) return brandInfo.signature.split(' ').slice(0, 4).join(' ');
    return null;
  })();
  let seoTitle = brandLabel ? `${brandLabel} ${name.replace(new RegExp(brandLabel, 'i'), '').trim()}` : name;
  if (benefit) seoTitle += ` — ${benefit}`;
  seoTitle = seoTitle.slice(0, 70);

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
  if (volume && cycles) shortParts.push(`Об'єм ${volume} — приблизно ${cycles} ${plural(cycles, ['прання', 'прань', 'прань'])}.`);
  if (brandInfo) shortParts.push(brandInfo.signature.charAt(0).toUpperCase() + brandInfo.signature.slice(1) + '.');
  const shortDescription = shortParts.join(' ');

  // Full description — 6 sections with real content
  const benefitsList: string[] = [];
  if (brandInfo) benefitsList.push(...brandInfo.highlights);
  if (aroma) benefitsList.push(`Приємний аромат ${aroma}, що тримається на тканині після прання`);
  if (cycles) benefitsList.push(`Економна витрата — вистачає на <strong>${cycles} ${plural(cycles, ['цикл', 'цикли', 'циклів'])} прання</strong>`);
  if (fabricType !== 'універсальний') benefitsList.push(`Спеціальна формула <strong>${fabricType}</strong> — захищає структуру волокон`);
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
    `<ul>${benefitsList.slice(0, 7).map((b) => `<li>${b}</li>`).join('')}</ul>`,
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
      seoTitle: `${name} — Pulito Trade`.slice(0, 70),
      seoDescription: `Технічна позиція в каталозі. Опис буде оновлено найближчим часом.`.slice(0, 160),
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

/**
 * Generate SEO content for a product. Uses Claude when ANTHROPIC_API_KEY is
 * set, falls back to deterministic rules otherwise.
 */
export async function generateForProduct(input: GenerateInput): Promise<GeneratedContent> {
  const fromClaude = await generateWithClaude(input);
  if (fromClaude) return fromClaude;
  return generateWithRules(input);
}
