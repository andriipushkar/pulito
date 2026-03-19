/**
 * Generate SEO-optimized product descriptions for all products.
 * Creates ProductContent records with shortDescription, fullDescription,
 * specifications, and usageInstructions.
 *
 * Usage: DATABASE_URL="postgresql://..." npx tsx scripts/generate-descriptions.ts
 */
import { PrismaClient } from '../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ProductInfo {
  name: string;
  category: string;
  volume: string;
  washes: string;
  brand: string;
  type: string;
}

interface ContentResult {
  shortDescription: string;
  fullDescription: string;
  specifications: string;
  usageInstructions: string;
}

function parseProduct(name: string, category: string): ProductInfo {
  const volMatch = name.match(/(\d+[.,]?\d*)\s*(мл|л|ml|g|гр|кг|шт|таб|капсул)/i);
  const volume = volMatch ? `${volMatch[1]} ${volMatch[2]}`.replace(',', '.') : '';
  const washMatch = name.match(/(\d+)\s*прань/i);
  const washes = washMatch ? washMatch[1] : '';
  const brandMatch = name.replace(/^New!?\s*/i, '').match(/^([A-ZА-ЯЄІЇҐa-zа-яєіїґ][A-Za-zА-Яа-яЄєІіЇїҐґ.'&]+)/);
  const brand = brandMatch ? brandMatch[1].trim() : name.split(/\s+/)[0];
  let type = 'універсальний';
  if (/колор|color|colorat/i.test(name)) type = 'для кольорових тканин';
  else if (/біл|bianc|white|bianco/i.test(name)) type = 'для білих тканин';
  else if (/чорн|темн|dark|nero|scur/i.test(name)) type = 'для темних та чорних тканин';
  else if (/делікат|lana|seta|capi delicati|шерст/i.test(name)) type = 'для делікатних тканин';
  else if (/спорт|sport/i.test(name)) type = 'для спортивного одягу';
  else if (/дитяч|bebe|baby/i.test(name)) type = 'для дитячої білизни';
  else if (/гіпоалерг|non.?bio|sensitive/i.test(name)) type = 'гіпоалергенний';
  return { name, category, volume, washes, brand, type };
}

const generators: Record<string, (p: ProductInfo) => ContentResult> = {
  'Гелі для прання': (p) => ({
    shortDescription: `${p.brand} ${p.type} гель для прання.${p.washes ? ` ${p.washes} прань.` : ''}${p.volume ? ` ${p.volume}.` : ''} Ефективно відпирає при 30°C.`,
    fullDescription: `<p>${p.name} — високоякісний гель ${p.type} від ${p.brand}. Ефективно видаляє забруднення навіть при низьких температурах, зберігаючи яскравість кольорів та структуру тканин.</p>
<ul>
<li>Глибоке очищення при температурі від 20°C</li>
<li>Не залишає розводів та білих слідів на одязі</li>
<li>Тривалий приємний аромат свіжості</li>
<li>Підходить для автоматичних та напівавтоматичних пральних машин</li>
<li>Концентрована формула — економна витрата</li>
<li>Безпечний для кольорових, білих та темних тканин</li>
</ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Гель для прання (${p.type})${p.volume ? `\nОб\'єм: ${p.volume}` : ''}${p.washes ? `\nКількість прань: ${p.washes}` : ''}\nТемпература: 20°C — 60°C\nВиробництво: ЄС (Італія/Німеччина)`,
    usageInstructions: `Додайте гель у відсік для прального засобу або безпосередньо в барабан пральної машини. Дозуйте відповідно до інструкції на упаковці. Для сильно забруднених речей збільшіть дозу на 50%.`,
  }),
  'Капсули для прання': (p) => ({
    shortDescription: `${p.brand} капсули для прання 3-в-1.${p.washes ? ` ${p.washes} капсул.` : ''} Пральний засіб + кондиціонер + плямовивідник.`,
    fullDescription: `<p>${p.name} — зручні капсули 3-в-1 від ${p.brand}: пральний засіб, кондиціонер та плямовивідник в одній капсулі. Розчиняються повністю при будь-якій температурі.</p>
<ul><li>Точне дозування без переливання</li><li>Розчиняються повністю навіть у холодній воді</li><li>Не потрібно вимірювати — 1 капсула = 1 прання</li><li>Компактна упаковка</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Капсули для прання${p.washes ? `\nУ пакуванні: ${p.washes} шт` : ''}\nТемпература: від 20°C`,
    usageInstructions: `Покладіть 1 капсулу в барабан пральної машини ПЕРЕД завантаженням білизни. Для сильних забруднень — 2 капсули. Не відкривайте та не проколюйте капсулу.`,
  }),
  'Порошки для прання': (p) => ({
    shortDescription: `${p.brand} пральний порошок.${p.volume ? ` ${p.volume}.` : ''} Видаляє складні забруднення та зберігає яскравість кольорів.`,
    fullDescription: `<p>${p.name} — ефективний пральний порошок від ${p.brand}. Відмінно справляється навіть зі складними плямами.</p>
<ul><li>Високоефективна формула</li><li>Зберігає кольори після багатьох прань</li><li>Підходить для ручного та машинного прання</li><li>Економна витрата</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Порошок для прання${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Додайте порошок у відсік для прального засобу. Дозування залежить від об'єму завантаження та ступеня забруднення.`,
  }),
  'Кондиціонери-ополіскувачі для прання': (p) => ({
    shortDescription: `${p.brand} кондиціонер для білизни.${p.volume ? ` ${p.volume}.` : ''}${p.washes ? ` ${p.washes} прань.` : ''} Неймовірна м'якість та аромат.`,
    fullDescription: `<p>${p.name} — кондиціонер від ${p.brand}, який надає тканинам м'якість та тривалий аромат свіжості.</p>
<ul><li>Надзвичайна м'якість тканин</li><li>Полегшує прасування</li><li>Тривалий аромат до кількох тижнів</li><li>Зменшує статичну електрику</li><li>Захищає волокна від зношування</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Кондиціонер-ополіскувач${p.volume ? `\nОб\'єм: ${p.volume}` : ''}${p.washes ? `\nКількість прань: ${p.washes}` : ''}`,
    usageInstructions: `Додайте кондиціонер у відсік для ополіскувача пральної машини. Не заливайте безпосередньо на білизну.`,
  }),
  'Плямовивідники': (p) => ({
    shortDescription: `${p.brand} плямовивідник.${p.volume ? ` ${p.volume}.` : ''} Видаляє жир, каву, вино, траву, кров.`,
    fullDescription: `<p>${p.name} — потужний плямовивідник від ${p.brand}. Видаляє навіть найстійкіші плями вже при 30°C.</p>
<ul><li>Ефективний з першого застосування</li><li>Безпечний для кольорових та білих тканин</li><li>Підсилює дію прального засобу</li><li>Можна використовувати для замочування</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Плямовивідник${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Нанесіть на пляму, зачекайте 5-10 хвилин, потім пріть як зазвичай. Для стійких плям замочіть на 30 хвилин.`,
  }),
  'Серветки для прання': (p) => ({
    shortDescription: `${p.brand} серветки для прання. Зручний формат — замінюють рідкий засіб. Ідеальні для подорожей.`,
    fullDescription: `<p>${p.name} — інноваційні серветки від ${p.brand}. Просто покладіть у барабан разом з білизною.</p><ul><li>Без розливів та вимірювань</li><li>Повністю розчиняються</li><li>Ідеальні для подорожей</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Серветки для прання`,
    usageInstructions: `Покладіть 1 серветку в барабан разом з білизною перед пранням.`,
  }),
  'Засоби для прання': (p) => ({
    shortDescription: `${p.brand} засіб для прання.${p.volume ? ` ${p.volume}.` : ''} Бездоганна чистота та свіжість білизни.`,
    fullDescription: `<p>${p.name} — засіб для прання від ${p.brand}. Ефективно видаляє забруднення та зберігає якість тканин.</p><ul><li>Ефективне видалення забруднень</li><li>Збереження кольорів</li><li>Приємний аромат</li></ul>`,
    specifications: `Бренд: ${p.brand}${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Дотримуйтесь інструкції на упаковці.`,
  }),
  'Засоби для миття посуду': (p) => ({
    shortDescription: `${p.brand} засіб для миття посуду.${p.volume ? ` ${p.volume}.` : ''} Легко розчиняє жир, посуд блискуче чистий.`,
    fullDescription: `<p>${p.name} — ефективний засіб для посуду від ${p.brand}. Потужна формула проти жиру, ніжний до рук.</p><ul><li>Розчиняє жир у холодній воді</li><li>Економна витрата — багато піни</li><li>Ніжний до шкіри рук</li><li>Повністю змивається водою</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Засіб для миття посуду${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Нанесіть кілька крапель на губку, спіньте та помийте посуд. Ретельно змийте водою.`,
  }),
  'Засоби для чищення': (p) => ({
    shortDescription: `${p.brand} засіб для чищення.${p.volume ? ` ${p.volume}.` : ''} Видаляє бруд, наліт, вапняний камінь.`,
    fullDescription: `<p>${p.name} — професійний засіб для чищення від ${p.brand}. Видаляє стійкі забруднення, надає блиск поверхням.</p><ul><li>Антибактеріальна дія</li><li>Не дряпає поверхні</li><li>Свіжий аромат</li><li>Зручна упаковка</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Засіб для чищення${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Нанесіть на поверхню, зачекайте 5 хвилин, протріть вологою ганчіркою. Для стійких забруднень залиште на 15 хвилин.`,
  }),
  'Засоби для миття та чищення': (p) => ({
    shortDescription: `${p.brand} засіб для миття та чищення.${p.volume ? ` ${p.volume}.` : ''} Універсальний помічник для домашнього прибирання.`,
    fullDescription: `<p>${p.name} — універсальний засіб від ${p.brand} для миття та чищення різних поверхонь.</p><ul><li>Підходить для різних поверхонь</li><li>Ефективно видаляє забруднення</li><li>Приємний аромат</li></ul>`,
    specifications: `Бренд: ${p.brand}${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Розведіть у воді або нанесіть безпосередньо на забруднення. Протріть ганчіркою.`,
  }),
  'Догляд за тілом': (p) => ({
    shortDescription: `${p.brand} засіб для догляду за тілом.${p.volume ? ` ${p.volume}.` : ''} Ніжне очищення та зволоження шкіри.`,
    fullDescription: `<p>${p.name} — засіб для тіла від ${p.brand}. Ніжно очищує, зволожує та захищає шкіру.</p><ul><li>Ніжне очищення та зволоження</li><li>Дерматологічно протестовано</li><li>Не висушує шкіру</li><li>Приємний аромат</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Догляд за тілом${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Нанесіть на вологу шкіру, спіньте масажними рухами, змийте водою.`,
  }),
  'Догляд за волоссям': (p) => ({
    shortDescription: `${p.brand} засіб для волосся.${p.volume ? ` ${p.volume}.` : ''} Глибоке очищення, живлення та блиск.`,
    fullDescription: `<p>${p.name} — засіб для волосся від ${p.brand}. Забезпечує глибоке очищення, живлення та захист від пошкоджень.</p><ul><li>Глибоке очищення та живлення</li><li>Блиск та об'єм</li><li>Легке розчісування</li><li>Захист від пошкоджень</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Догляд за волоссям${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Нанесіть на вологе волосся, масажуйте шкіру голови, ретельно змийте.`,
  }),
  'Засоби гігієни': (p) => ({
    shortDescription: `${p.brand} засіб гігієни.${p.volume ? ` ${p.volume}.` : ''} Надійний захист, свіжість та комфорт.`,
    fullDescription: `<p>${p.name} — засіб гігієни від ${p.brand}. Надійний захист та свіжість протягом дня.</p><ul><li>Тривалий захист</li><li>Ніжний до шкіри</li><li>Дерматологічно протестовано</li></ul>`,
    specifications: `Бренд: ${p.brand}${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Дотримуйтесь інструкції на упаковці.`,
  }),
  'Засоби для гоління': (p) => ({
    shortDescription: `${p.brand} засіб для гоління.${p.volume ? ` ${p.volume}.` : ''} Комфортне гоління без подразнення.`,
    fullDescription: `<p>${p.name} — засіб для гоління від ${p.brand}. Гладке ковзання, захист від порізів та подразнення.</p><ul><li>Гладке гоління</li><li>Зволоження шкіри</li><li>Захист від подразнення</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Засіб для гоління${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Нанесіть на зволожену шкіру обличчя перед голінням.`,
  }),
  'Засоби для ротової порожнини': (p) => ({
    shortDescription: `${p.brand} засіб для ротової порожнини.${p.volume ? ` ${p.volume}.` : ''} Захист від карієсу, свіже дихання.`,
    fullDescription: `<p>${p.name} — засіб для ротової порожнини від ${p.brand}. Захист від карієсу, здоров'я ясен та свіже дихання.</p><ul><li>Захист від карієсу</li><li>Зміцнення емалі</li><li>Свіже дихання до 12 годин</li><li>Рекомендовано стоматологами</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Засіб для ротової порожнини${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Для зубної пасти: чистіть зуби 2 рази на день. Для ополіскувача: полощіть рот 30 секунд після чищення.`,
  }),
  'Товари для дому': (p) => ({
    shortDescription: `${p.brand} товар для дому. Якість та зручність для повсякденного використання.`,
    fullDescription: `<p>${p.name} — побутовий товар від ${p.brand}. Висока якість та практичність.</p><ul><li>Високоякісні матеріали</li><li>Практичність</li><li>Довговічність</li></ul>`,
    specifications: `Бренд: ${p.brand}`,
    usageInstructions: `Дотримуйтесь інструкції на упаковці.`,
  }),
  'Губки, скребки, ганчірки, швабри': (p) => ({
    shortDescription: `${p.brand} інструмент для прибирання. Ефективне збирання бруду, довговічні матеріали.`,
    fullDescription: `<p>${p.name} — інструмент для прибирання від ${p.brand}. Високоякісні матеріали для ефективного прибирання.</p><ul><li>Якісні матеріали</li><li>Ефективне збирання пилу та бруду</li><li>Довговічність</li><li>Не залишає розводів</li></ul>`,
    specifications: `Бренд: ${p.brand}\nТип: Засіб для прибирання`,
    usageInstructions: `Зволожте перед використанням (для мікрофібри). Після використання промийте водою та висушіть.`,
  }),
  'Різне': (p) => ({
    shortDescription: `${p.brand} побутовий засіб. Європейська якість за доступною ціною.${p.volume ? ` ${p.volume}.` : ''}`,
    fullDescription: `<p>${p.name} — якісний побутовий засіб від ${p.brand}.</p><ul><li>Європейська якість</li><li>Ефективна формула</li><li>Доступна ціна</li></ul>`,
    specifications: `Бренд: ${p.brand}${p.volume ? `\nОб\'єм: ${p.volume}` : ''}`,
    usageInstructions: `Дотримуйтесь інструкції на упаковці.`,
  }),
};

async function main() {
  // Get products that don't have content yet
  const productsWithContent = await prisma.productContent.findMany({ select: { productId: true } });
  const hasContentIds = new Set(productsWithContent.map(pc => pc.productId));
  
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, category: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });
  
  const products = allProducts.filter(p => !hasContentIds.has(p.id));
  console.log(`Всього товарів: ${allProducts.length} | Без опису: ${products.length}`);
  
  let created = 0, errors = 0;

  for (const product of products) {
    const catName = product.category?.name || 'Різне';
    const info = parseProduct(product.name, catName);
    const generator = generators[catName] || generators['Різне'];
    const content = generator(info);

    try {
      await prisma.productContent.create({
        data: {
          productId: product.id,
          shortDescription: content.shortDescription.slice(0, 200),
          fullDescription: content.fullDescription,
          specifications: content.specifications,
          usageInstructions: content.usageInstructions,
          isFilled: true,
        },
      });
      created++;
      if (created % 50 === 0) console.log(`  Створено: ${created}/${products.length}`);
    } catch (e: any) {
      errors++;
      if (errors <= 3) console.error(`  Помилка ID ${product.id}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`\nГотово! Створено описів: ${created} | Помилок: ${errors}`);
  await prisma.$disconnect();
}

main().catch(console.error);
