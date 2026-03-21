import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import {
  BRAND, PAGE, setupDoc, drawHeader, drawDocTitle, drawSectionTitle, drawFooter, getCompanyInfo,
} from '@/lib/pdf-theme';

interface ManualSection {
  title: string;
  content: string[];
}

const SECTIONS: ManualSection[] = [
  {
    title: '1. Вхід у систему',
    content: [
      'Відкрийте адмін-панель за адресою: /admin',
      'Введіть свій email та пароль. Якщо увімкнена двофакторна автентифікація (2FA), введіть код з додатку Google Authenticator.',
      'Після входу ви потрапите на головний дашборд з основними метриками.',
    ],
  },
  {
    title: '2. Управління товарами',
    content: [
      'Перейдіть у розділ "Товари" в бічному меню.',
      'Додавання товару: натисніть кнопку "Додати товар", заповніть назву, код, ціну (роздріб та опт), кількість, оберіть категорію та завантажте фото.',
      'Редагування: натисніть на товар у списку, внесіть зміни та збережіть.',
      'Видалення: товар переміщується у "кошик" (soft delete) і автоматично видаляється через 90 днів.',
      'Імпорт товарів: використовуйте кнопку "Імпорт" для масового завантаження з Excel/CSV файлу.',
      'Фото товарів автоматично конвертуються у формат WebP для оптимізації швидкості сайту.',
    ],
  },
  {
    title: '3. Категорії',
    content: [
      'Розділ "Категорії" дозволяє створювати ієрархію товарів.',
      'Кожна категорія має назву, slug (для URL), зображення та батьківську категорію (для вкладеності).',
      'Порядок сортування категорій налаштовується перетягуванням (drag & drop).',
    ],
  },
  {
    title: '4. Замовлення',
    content: [
      'Перейдіть у розділ "Замовлення" для перегляду всіх замовлень.',
      'Статуси замовлень: Нове → В обробці → Підтверджено → Оплачено → Відправлено → Виконано.',
      'Для зміни статусу відкрийте замовлення та оберіть новий статус. Клієнт отримає сповіщення автоматично.',
      'Рахунок-фактура генерується автоматично і доступна для завантаження у PDF.',
      'ТТН (номер відправлення) вводиться вручну або заповнюється автоматично через інтеграцію з Новою Поштою.',
    ],
  },
  {
    title: '5. Клієнти',
    content: [
      'Розділ "Клієнти" містить базу всіх зареєстрованих користувачів.',
      'Типи клієнтів: роздрібний, оптовий (потребує підтвердження менеджером).',
      'Для оптових клієнтів можна налаштувати персональні ціни та групи знижок.',
      'Історія замовлень, бонусні бали та реферальна статистика доступні у профілі клієнта.',
    ],
  },
  {
    title: '6. Програма лояльності',
    content: [
      'Система бонусних балів нараховує бали за кожну покупку.',
      'Налаштування рівнів лояльності: Адмін → Налаштування → Лояльність.',
      'Менеджер може вручну нарахувати або списати бали клієнту з коментарем.',
      'Клієнт може витратити бали при оформленні замовлення.',
    ],
  },
  {
    title: '7. Купони та знижки',
    content: [
      'Створення купонів: Адмін → Купони → Додати.',
      'Типи купонів: фіксована знижка (грн), відсоткова знижка (%).',
      'Можна встановити: мінімальну суму замовлення, ліміт використань, термін дії.',
      'Статистика використання купонів доступна у розділі аналітики.',
    ],
  },
  {
    title: '8. Боти (Telegram / Viber)',
    content: [
      'Telegram-бот та Viber-бот дозволяють клієнтам отримувати сповіщення про статус замовлення.',
      'Налаштування ботів: Адмін → Боти → обрати платформу.',
      'Бот автоматично надсилає повідомлення при зміні статусу замовлення.',
      'Промо-розсилки через бота налаштовуються в розділі "Публікації".',
    ],
  },
  {
    title: '9. Аналітика',
    content: [
      'Дашборд аналітики доступний у розділі Адмін → Аналітика.',
      'Доступні звіти: Продажі, ABC-аналіз, RFM-сегментація, LTV клієнтів, Когортний аналіз, Воронка конверсії, Прогноз відтоку.',
      'Звіти можна експортувати у PDF для друку або відправки керівництву.',
      'Аналітика оновлюється автоматично щоденно через фонові завдання.',
    ],
  },
  {
    title: '10. Оплата та платіжні системи',
    content: [
      'Підтримувані платіжні системи: LiqPay, Monobank, WayForPay.',
      'Статус оплати оновлюється автоматично через вебхуки від платіжної системи.',
      'При проблемах з оплатою перевірте розділ Адмін → Вебхук-логи.',
    ],
  },
  {
    title: '11. Доставка',
    content: [
      'Підтримувані служби доставки: Нова Пошта, Укрпошта, Палетна доставка.',
      'Трекінг посилки автоматично перевіряється системою і оновлює статус замовлення.',
      'Вартість палетної доставки розраховується автоматично на основі ваги та відстані.',
    ],
  },
  {
    title: '12. Публікації та контент',
    content: [
      'Розділ "Публікації" дозволяє створювати пости для соціальних мереж (Telegram, Viber, Instagram).',
      'Публікації можна запланувати на конкретну дату та час.',
      'Статистика переглядів та кліків доступна для кожної публікації.',
    ],
  },
  {
    title: '13. SEO та маркетинг',
    content: [
      'SEO-налаштування для кожного товару та категорії: meta title, description, alt-теги зображень.',
      'Автоматична генерація sitemap.xml для пошукових систем.',
      'Фонова перевірка "битих" посилань раз на тиждень з повідомленням адміністратору.',
    ],
  },
  {
    title: '14. Прайс-листи та каталоги',
    content: [
      'Генерація прайс-листів: Адмін → Прайс-листи → Генерувати (роздрібний або оптовий).',
      'Ілюстрований каталог товарів генерується з розбивкою по категоріях.',
      'Файли зберігаються у форматі PDF і доступні для завантаження.',
    ],
  },
  {
    title: '15. Безпека',
    content: [
      'Рекомендовано увімкнути 2FA (двофакторну автентифікацію) для всіх адміністраторів.',
      'Налаштування 2FA: Профіль → Безпека → Увімкнути 2FA.',
      'Усі дії адміністраторів записуються в журнал аудиту.',
      'Паролі зберігаються у зашифрованому вигляді (bcrypt).',
    ],
  },
];

export async function generateUserManual(): Promise<string> {
  const company = await getCompanyInfo();

  const manualDir = path.join(env.UPLOAD_DIR, 'docs');
  if (!existsSync(manualDir)) {
    mkdirSync(manualDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `user-manual_${timestamp}.pdf`;
  const filePath = path.join(manualDir, fileName);
  const publicUrl = `/uploads/docs/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  setupDoc(doc);
  doc.font('Regular');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Title page
  drawHeader(doc, company);
  drawDocTitle(
    doc,
    'Інструкція користувача',
    'Керівництво для менеджера адмін-панелі',
    new Date().toLocaleDateString('uk-UA'),
  );

  doc.moveDown(2);
  doc.font('Regular').fontSize(11).fillColor(BRAND.textSecondary);
  doc.text('Цей документ містить покрокову інструкцію з управління інтернет-магазином через адмін-панель.', {
    align: 'center',
    width: PAGE.contentWidth,
  });
  doc.moveDown(1);
  doc.text('Для менеджерів та адміністраторів.', { align: 'center' });

  // Table of contents
  drawFooter(doc, company);
  doc.addPage();
  drawHeader(doc, company);
  doc.font('Bold').fontSize(14).fillColor(BRAND.text).text('Зміст', { align: 'center' });
  doc.moveDown(1);

  for (const section of SECTIONS) {
    doc.font('Regular').fontSize(10).fillColor(BRAND.primary).text(section.title);
    doc.moveDown(0.3);
  }

  // Content sections
  for (const section of SECTIONS) {
    drawFooter(doc, company);
    doc.addPage();
    drawHeader(doc, company);
    drawSectionTitle(doc, section.title);
    doc.moveDown(0.5);

    for (const paragraph of section.content) {
      if (doc.y > 740) {
        drawFooter(doc, company);
        doc.addPage();
        drawHeader(doc, company);
      }

      // Detect if it's a sub-item (starts with a specific pattern)
      const isBullet = paragraph.includes(':') && paragraph.indexOf(':') < 40;

      if (isBullet) {
        const [label, ...rest] = paragraph.split(':');
        doc.font('Bold').fontSize(10).fillColor(BRAND.text).text(`• ${label}:`, 50, doc.y, { continued: true });
        doc.font('Regular').fillColor(BRAND.textSecondary).text(rest.join(':'), { width: 480 });
      } else {
        doc.font('Regular').fontSize(10).fillColor(BRAND.text).text(`• ${paragraph}`, 50, doc.y, { width: 480 });
      }
      doc.moveDown(0.5);
    }
  }

  // Final page
  drawFooter(doc, company);
  doc.addPage();
  drawHeader(doc, company);
  doc.moveDown(4);
  doc.font('Bold').fontSize(16).fillColor(BRAND.primary).text('Потрібна допомога?', { align: 'center' });
  doc.moveDown(1);
  doc.font('Regular').fontSize(11).fillColor(BRAND.textSecondary);
  if (company.email) {
    doc.text(`Email: ${company.email}`, { align: 'center' });
  }
  if (company.phone) {
    doc.text(`Телефон: ${company.phone}`, { align: 'center' });
  }
  if (company.website) {
    doc.text(`Сайт: ${company.website}`, { align: 'center' });
  }

  drawFooter(doc, company);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
