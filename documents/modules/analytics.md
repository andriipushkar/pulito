# Модуль аналітики

## Огляд

Аналітична система збирає дані про поведінку користувачів, воронку продажів, когортний аналіз, ABC-аналіз товарів та Web Vitals.

## Збір даних

### ClientEvent (client_events)

Всі події клієнтів записуються в одну таблицю:

```
ClientEvent {
  eventType  String  // 'page_view', 'product_view', 'add_to_cart', 'checkout_start', etc.
  userId     Int?    // для авторизованих
  sessionId  String? // для анонімних
  productId  Int?    // якщо подія пов'язана з товаром
  orderId    Int?    // якщо пов'язана з замовленням
  metadata   Json?   // додаткові дані
}
```

**Індекси:**
- `[eventType, createdAt]` -- фільтрація за типом
- `[userId, createdAt]` -- історія користувача
- `[sessionId]` -- сесія відвідувача

### DailyFunnelStats (daily_funnel_stats)

Агреговані дані по днях:

| Поле | Опис |
|------|------|
| `date` | Дата |
| `deviceType` | desktop / mobile / tablet |
| `trafficSource` | Джерело трафіку |
| `pageViews` | Перегляди сторінок |
| `productViews` | Перегляди товарів |
| `addToCartCount` | Додавання в кошик |
| `cartViews` | Перегляди кошика |
| `checkoutStarts` | Початок оформлення |
| `ordersCompleted` | Завершені замовлення |
| `totalRevenue` | Загальний дохід |
| `uniqueVisitors` | Унікальні відвідувачі |

### ChannelVisit (channel_visits)

Відстеження каналів трафіку:
- UTM-мітки (source, medium, campaign)
- Landing page
- Конверсія в замовлення

## Воронка конверсій

**Сервіс:** `getConversionFunnel(days)`

Агрегує DailyFunnelStats за вказаний період та обчислює:

**Кроки воронки:**
1. Перегляди сторінок
2. Перегляди товарів
3. Додавання в кошик
4. Перегляди кошика
5. Початок оформлення
6. Завершені замовлення

**Метрики для кожного кроку:**
- `value` -- абсолютне значення
- `conversionFromPrev` -- конверсія від попереднього кроку (%)
- `conversionFromFirst` -- конверсія від першого кроку (%)

**UI компонент:** `src/components/admin/analytics/ConversionFunnel.tsx`

## Когортний аналіз

**Сервіс:** `getCohortAnalysis(months = 6)`

Групує користувачів за місяцем реєстрації та показує відсоток тих, хто зробив замовлення в наступних місяцях.

**Результат:**
```ts
{
  cohort: "2025-01",    // місяць реєстрації
  totalUsers: 150,       // кількість користувачів
  retention: {
    "2025-01": 30,       // 30% зробили замовлення в перший місяць
    "2025-02": 15,       // 15% в наступний
    "2025-03": 10,
  }
}
```

Виключає скасовані замовлення.

**UI компонент:** `src/components/admin/analytics/CohortAnalysis.tsx`

## ABC-аналіз товарів

**Сервіс:** `getABCAnalysis(days)`

Класифікує товари за внеском у дохід:

| Категорія | Частка доходу | Опис |
|-----------|---------------|------|
| A | 80% | Топ-товари, основний дохід |
| B | 15% (80-95%) | Середні товари |
| C | 5% (95-100%) | Низькодохідні товари |

**Дані для кожного товару:**
- `productCode`, `productName`
- `revenue` -- дохід
- `quantity` -- кількість продажів
- `orders` -- кількість замовлень
- `revenuePercent` -- відсоток від загального доходу
- `cumulativePercent` -- кумулятивний відсоток
- `category` -- A / B / C

**Підсумок:** кількість товарів у кожній категорії, загальний дохід.

**UI компонент:** `src/components/admin/analytics/ABCAnalysis.tsx`

## Web Vitals (Performance Metrics)

### Модель PerformanceMetric

```
PerformanceMetric {
  date        Date
  route       String   // маршрут сторінки
  metric      String   // 'LCP', 'CLS', 'FID', 'TTFB', 'INP'
  p50         Float    // перцентиль 50
  p75         Float    // перцентиль 75
  p90         Float    // перцентиль 90
  sampleCount Int
}
// Unique: [date, route, metric]
```

**Сервіс:** `src/services/performance.ts`

**UI компонент:** `src/components/admin/analytics/PerformanceWidget.tsx`

## Додаткові аналітичні модулі

### Аналітика запасів
**UI компонент:** `src/components/admin/analytics/StockAnalytics.tsx`
- Low-stock alerts (поріг налаштовується в DashboardSettings)
- Аналіз оборотності

### Аналітика цін
**UI компонент:** `src/components/admin/analytics/PriceAnalytics.tsx`
- Історія змін цін (PriceHistory)
- Графіки цін

### Аналітика каналів
**UI компонент:** `src/components/admin/analytics/ChannelAnalytics.tsx`
- Статистика підписників (ChannelStats)
- Порівняння каналів (Telegram, Viber, Instagram)

### Географічна аналітика
**UI компонент:** `src/components/admin/analytics/GeographyAnalytics.tsx`
- Розподіл замовлень за містами/регіонами

## Дашборд

**Сервіс:** `src/services/dashboard.ts`

**Endpoint:** `GET /api/v1/admin/dashboard/stats`

Агрегує:
- Кількість нових замовлень
- Загальний дохід за період
- Кількість нових клієнтів
- Товари з низьким запасом

### Налаштування дашборду (DashboardSettings)
- `layout` -- JSON конфігурація віджетів
- `lowStockThreshold` -- поріг низького запасу (за замовчуванням 10)
- `refreshIntervalSeconds` -- інтервал оновлення (за замовчуванням 60)

## Звіти

### ReportTemplate

Шаблони звітів з можливістю планування:
- `reportType` -- тип звіту
- `filters` -- JSON фільтри
- `metrics` -- JSON метрики
- `schedule` -- cron-вираз
- `scheduleEmail` -- email для відправки

### Аналітичні сповіщення (AnalyticsAlert)

Автоматичні сповіщення при досягненні умов:
- `alertType` -- тип сповіщення
- `condition` -- JSON умова
- `notificationChannels` -- канали доставки
- `lastTriggeredAt` -- останнє спрацювання

## Сервіси звітів

- `src/services/analytics-reports.ts` -- генерація звітів
- `src/services/analytics-pdf.ts` -- експорт аналітики в PDF
- `src/services/report-generator.ts` -- генератор звітів

## Файли модуля

- `src/services/analytics.ts` -- воронка, когорти, ABC-аналіз
- `src/services/dashboard.ts` -- дашборд статистика
- `src/services/performance.ts` -- Web Vitals
- `src/services/analytics-reports.ts` -- звіти
- `src/services/analytics-pdf.ts` -- PDF-звіти
- `src/components/admin/analytics/` -- UI віджети
- `src/app/api/v1/admin/dashboard/stats/route.ts` -- API
- `src/app/(admin)/admin/reports/page.tsx` -- сторінка звітів
