import { sendEmail } from './email';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';

function baseLayout(content: string): string {
  const primaryColor = '#2563eb';
  return `
<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:${primaryColor};padding:24px;text-align:center">
          <a href="${env.APP_URL}" style="color:#ffffff;font-size:24px;font-weight:bold;text-decoration:none">Pulito Trade</a>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px 24px">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8">
            © ${new Date().getFullYear()} Pulito Trade. Усі права захищені.<br>
            <a href="${env.APP_URL}" style="color:${primaryColor};text-decoration:none">${env.APP_URL}</a>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">
            <a href="${env.APP_URL}/api/v1/subscribe?action=unsubscribe&email={{email}}" style="color:#94a3b8;text-decoration:underline">Відписатися від розсилки</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">${text}</a>`;
}

/**
 * Try to render an email template from the database.
 * Replaces {variable} placeholders with provided values.
 * Returns null if template is not found or inactive.
 */
async function renderDbTemplate(
  templateKey: string,
  variables: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { templateKey },
    });

    if (!template || !template.isActive) return null;

    let subject = template.subject;
    let body = template.bodyHtml;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      subject = subject.replace(placeholder, value);
      body = body.replace(placeholder, value);
    }

    return { subject, html: baseLayout(body) };
  } catch {
    return null;
  }
}

export async function sendOrderConfirmation(data: {
  to: string;
  name: string;
  orderNumber: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  deliveryMethod: string;
}) {
  // Try DB template first
  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.name}</td>
         <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${i.quantity}</td>
         <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${(i.price * i.quantity).toFixed(2)} ₴</td></tr>`,
    )
    .join('');

  const dbTemplate = await renderDbTemplate('order_confirmation', {
    name: data.name,
    order_number: data.orderNumber,
    items_table: itemRows,
    total: data.total.toFixed(2),
    delivery_method: data.deliveryMethod,
    orders_url: `${env.APP_URL}/account/orders`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Замовлення підтверджено!</h2>
    <p style="color:#475569">Шановний(а) ${data.name},</p>
    <p style="color:#475569">Дякуємо за замовлення <strong>#${data.orderNumber}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:8px;text-align:left">Товар</th>
        <th style="padding:8px;text-align:center">Кількість</th>
        <th style="padding:8px;text-align:right">Сума</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:12px 8px;font-weight:bold">Разом:</td>
        <td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px">${data.total.toFixed(2)} ₴</td>
      </tr></tfoot>
    </table>
    <p style="color:#475569">Спосіб доставки: <strong>${data.deliveryMethod}</strong></p>
    <p style="color:#475569">Менеджер зв'яжеться з вами для підтвердження деталей.</p>
    ${button('Переглянути замовлення', `${env.APP_URL}/account/orders`)}
  `;

  await sendEmail({
    to: data.to,
    subject: `Замовлення #${data.orderNumber} підтверджено — Pulito Trade`,
    html: baseLayout(content),
  });
}

export async function sendOrderStatusChanged(data: {
  to: string;
  name: string;
  orderNumber: string;
  newStatus: string;
  comment?: string;
  trackingNumber?: string;
  orderId: number;
}) {
  const dbTemplate = await renderDbTemplate('order_status_changed', {
    name: data.name,
    order_number: data.orderNumber,
    new_status: data.newStatus,
    tracking_number: data.trackingNumber || '',
    comment: data.comment || '',
    order_url: `${env.APP_URL}/account/orders/${data.orderId}`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  let extra = '';
  if (data.trackingNumber) {
    extra = `<p style="color:#475569">Номер ТТН: <strong>${data.trackingNumber}</strong></p>`;
  }
  if (data.comment) {
    extra += `<p style="color:#475569">Коментар: ${data.comment}</p>`;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Оновлення замовлення #${data.orderNumber}</h2>
    <p style="color:#475569">Шановний(а) ${data.name},</p>
    <p style="color:#475569">Статус вашого замовлення змінено на: <strong>${data.newStatus}</strong></p>
    ${extra}
    ${button('Переглянути замовлення', `${env.APP_URL}/account/orders/${data.orderId}`)}
  `;

  await sendEmail({
    to: data.to,
    subject: `Замовлення #${data.orderNumber} — ${data.newStatus} — Pulito Trade`,
    html: baseLayout(content),
  });
}

export async function sendWelcomeEmail(data: { to: string; name: string }) {
  const dbTemplate = await renderDbTemplate('welcome', {
    name: data.name,
    catalog_url: `${env.APP_URL}/catalog`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Ласкаво просимо!</h2>
    <p style="color:#475569">Шановний(а) ${data.name},</p>
    <p style="color:#475569">Дякуємо за реєстрацію в Pulito Trade! Тепер вам доступні:</p>
    <ul style="color:#475569">
      <li>Особистий кабінет з історією замовлень</li>
      <li>Списки бажань та обране</li>
      <li>Сповіщення про акції та знижки</li>
    </ul>
    ${button('Перейти до каталогу', `${env.APP_URL}/catalog`)}
  `;

  await sendEmail({
    to: data.to,
    subject: 'Ласкаво просимо до Pulito Trade!',
    html: baseLayout(content),
  });
}

export async function sendDigestEmail(data: {
  to: string;
  name: string;
  newProducts: { name: string; price: number; slug: string }[];
  promoProducts: { name: string; price: number; oldPrice: number; slug: string }[];
  period: string;
}) {
  const newProductRows = data.newProducts
    .map(
      (p) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">
          <a href="${env.APP_URL}/product/${p.slug}" style="color:#2563eb;text-decoration:none">${p.name}</a>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${p.price.toFixed(2)} ₴</td></tr>`,
    )
    .join('');

  const promoRows = data.promoProducts
    .map(
      (p) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">
          <a href="${env.APP_URL}/product/${p.slug}" style="color:#2563eb;text-decoration:none">${p.name}</a>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">
          <span style="text-decoration:line-through;color:#94a3b8">${p.oldPrice.toFixed(2)} ₴</span>
          <strong style="color:#ef4444"> ${p.price.toFixed(2)} ₴</strong>
        </td></tr>`,
    )
    .join('');

  const dbTemplate = await renderDbTemplate('digest', {
    name: data.name,
    period: data.period,
    new_products_table: newProductRows,
    promo_products_table: promoRows,
    catalog_url: `${env.APP_URL}/catalog`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Щотижневий дайджест Pulito Trade</h2>
    <p style="color:#475569">Шановний(а) ${data.name},</p>
    <p style="color:#475569">Ось що нового за ${data.period}:</p>
    ${
      data.newProducts.length > 0
        ? `
      <h3 style="margin:16px 0 8px;color:#1e293b">Нові товари</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
        ${newProductRows}
      </table>
    `
        : ''
    }
    ${
      data.promoProducts.length > 0
        ? `
      <h3 style="margin:16px 0 8px;color:#1e293b">Акційні пропозиції</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
        ${promoRows}
      </table>
    `
        : ''
    }
    ${button('Переглянути каталог', `${env.APP_URL}/catalog`)}
    <img src="${env.APP_URL}/api/v1/metrics?type=email_open&id={{notificationId}}" width="1" height="1" alt="" style="display:block" />
  `;

  await sendEmail({
    to: data.to,
    subject: `Дайджест Pulito Trade — ${data.period}`,
    html: baseLayout(content),
  });
}

export async function sendCartAbandonmentEmail(data: {
  to: string;
  name: string;
  items: { name: string; quantity: number; price: number }[];
  cartUrl: string;
}) {
  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.name}</td>
         <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${i.quantity}</td>
         <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${(i.price * i.quantity).toFixed(2)} ₴</td></tr>`,
    )
    .join('');

  const total = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const dbTemplate = await renderDbTemplate('cart_abandonment', {
    name: data.name,
    items_table: itemRows,
    total: total.toFixed(2),
    cart_url: data.cartUrl,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Ви забули товари в кошику!</h2>
    <p style="color:#475569">Шановний(а) ${data.name},</p>
    <p style="color:#475569">Ви залишили товари в кошику. Вони все ще чекають на вас:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:8px;text-align:left">Товар</th>
        <th style="padding:8px;text-align:center">Кількість</th>
        <th style="padding:8px;text-align:right">Сума</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:12px 8px;font-weight:bold">Разом:</td>
        <td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px">${total.toFixed(2)} ₴</td>
      </tr></tfoot>
    </table>
    ${button('Повернутися до кошика', data.cartUrl)}
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">Наявність та ціни можуть змінитися.</p>
    <img src="${env.APP_URL}/api/v1/metrics?type=email_open&id={{notificationId}}" width="1" height="1" alt="" style="display:block" />
  `;

  await sendEmail({
    to: data.to,
    subject: 'Ви забули товари в кошику — Pulito Trade',
    html: baseLayout(content),
  });
}

export async function sendWholesaleApproved(data: {
  to: string;
  companyName: string;
  managerName?: string;
  managerPhone?: string;
}) {
  const dbTemplate = await renderDbTemplate('wholesale_approved', {
    company_name: data.companyName,
    manager_name: data.managerName || '',
    manager_phone: data.managerPhone || '',
    account_url: `${env.APP_URL}/account`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  let managerInfo = '';
  if (data.managerName) {
    managerInfo = `
      <p style="color:#475569">Ваш персональний менеджер: <strong>${data.managerName}</strong></p>
      ${data.managerPhone ? `<p style="color:#475569">Телефон: <a href="tel:${data.managerPhone}">${data.managerPhone}</a></p>` : ''}
    `;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Гуртовий статус підтверджено!</h2>
    <p style="color:#475569">Шановна компаніє ${data.companyName},</p>
    <p style="color:#475569">Ваш запит на гуртовий статус схвалено. Тепер вам доступні гуртові ціни та розширений функціонал.</p>
    ${managerInfo}
    ${button('Перейти до кабінету', `${env.APP_URL}/account`)}
  `;

  await sendEmail({
    to: data.to,
    subject: 'Гуртовий статус підтверджено — Pulito Trade',
    html: baseLayout(content),
  });
}

export async function sendWholesaleRejected(data: {
  to: string;
  companyName: string;
  reason: string;
}) {
  const dbTemplate = await renderDbTemplate('wholesale_rejected', {
    company_name: data.companyName,
    reason: data.reason,
    contact_url: `${env.APP_URL}/contact`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Запит на гуртовий статус відхилено</h2>
    <p style="color:#475569">Шановна компаніє ${data.companyName},</p>
    <p style="color:#475569">На жаль, ваш запит на гуртовий статус було відхилено.</p>
    <p style="color:#475569">Причина: <strong>${data.reason}</strong></p>
    <p style="color:#475569">Якщо ви вважаєте це помилкою або маєте додаткові запитання, будь ласка, зверніться до нашої служби підтримки.</p>
    ${button("Зв'язатися з нами", `${env.APP_URL}/contact`)}
  `;

  await sendEmail({
    to: data.to,
    subject: 'Запит на гуртовий статус відхилено — Pulito Trade',
    html: baseLayout(content),
  });
}

export async function sendNewOrderToManager(data: {
  to: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerType: 'client' | 'wholesaler';
  total: number;
  itemCount: number;
  orderId: number;
}) {
  const dbTemplate = await renderDbTemplate('order_new_manager', {
    order_number: data.orderNumber,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_type: data.customerType === 'wholesaler' ? 'Гуртівник' : 'Клієнт',
    total: data.total.toFixed(2),
    item_count: String(data.itemCount),
    order_url: `${env.APP_URL}/admin/orders/${data.orderId}`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const customerLabel = data.customerType === 'wholesaler' ? 'Гуртівник' : 'Клієнт';
  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Нове замовлення #${data.orderNumber}</h2>
    <p style="color:#475569"><strong>Тип:</strong> ${customerLabel}</p>
    <p style="color:#475569"><strong>Клієнт:</strong> ${data.customerName}</p>
    <p style="color:#475569"><strong>Телефон:</strong> <a href="tel:${data.customerPhone}">${data.customerPhone}</a></p>
    <p style="color:#475569"><strong>Кількість позицій:</strong> ${data.itemCount}</p>
    <p style="color:#475569"><strong>Сума:</strong> ${data.total.toFixed(2)} ₴</p>
    ${button('Перейти до замовлення', `${env.APP_URL}/admin/orders/${data.orderId}`)}
  `;

  await sendEmail({
    to: data.to,
    subject: `Нове замовлення #${data.orderNumber} (${customerLabel})`,
    html: baseLayout(content),
  });
}

export async function sendWholesaleRequestToManager(data: {
  to: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  edrpou?: string;
  userId: number;
}) {
  const dbTemplate = await renderDbTemplate('wholesale_request', {
    company_name: data.companyName,
    contact_name: data.contactName,
    contact_email: data.contactEmail,
    contact_phone: data.contactPhone,
    edrpou: data.edrpou ?? '—',
    user_url: `${env.APP_URL}/admin/users/${data.userId}`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Новий запит на гуртовий статус</h2>
    <p style="color:#475569"><strong>Компанія:</strong> ${data.companyName}</p>
    <p style="color:#475569"><strong>Контактна особа:</strong> ${data.contactName}</p>
    <p style="color:#475569"><strong>Email:</strong> <a href="mailto:${data.contactEmail}">${data.contactEmail}</a></p>
    <p style="color:#475569"><strong>Телефон:</strong> <a href="tel:${data.contactPhone}">${data.contactPhone}</a></p>
    ${data.edrpou ? `<p style="color:#475569"><strong>ЄДРПОУ:</strong> ${data.edrpou}</p>` : ''}
    ${button('Розглянути запит', `${env.APP_URL}/admin/users/${data.userId}`)}
  `;

  await sendEmail({
    to: data.to,
    subject: `Новий запит на гуртовий статус — ${data.companyName}`,
    html: baseLayout(content),
  });
}

export async function sendInvoiceCreatedEmail(data: {
  to: string;
  name: string;
  orderNumber: string;
  invoiceNumber: string;
  total: number;
  invoiceUrl: string;
  orderId: number;
}) {
  const dbTemplate = await renderDbTemplate('invoice_created', {
    name: data.name,
    order_number: data.orderNumber,
    invoice_number: data.invoiceNumber,
    total: data.total.toFixed(2),
    invoice_url: data.invoiceUrl,
    order_url: `${env.APP_URL}/account/orders/${data.orderId}`,
  });

  if (dbTemplate) {
    await sendEmail({ to: data.to, subject: dbTemplate.subject, html: dbTemplate.html });
    return;
  }

  const content = `
    <h2 style="margin:0 0 16px;color:#1e293b">Рахунок-фактура готовий</h2>
    <p style="color:#475569">Шановний(а) ${data.name},</p>
    <p style="color:#475569">Для замовлення <strong>#${data.orderNumber}</strong> сформовано рахунок-фактуру <strong>${data.invoiceNumber}</strong> на суму <strong>${data.total.toFixed(2)} ₴</strong>.</p>
    ${button('Завантажити рахунок (PDF)', data.invoiceUrl)}
    <p style="color:#94a3b8;font-size:12px;margin-top:12px">Якщо посилання на рахунок не відкривається, відкрийте сторінку замовлення в особистому кабінеті.</p>
    ${button('Перейти до замовлення', `${env.APP_URL}/account/orders/${data.orderId}`)}
  `;

  await sendEmail({
    to: data.to,
    subject: `Рахунок-фактура ${data.invoiceNumber} — Pulito Trade`,
    html: baseLayout(content),
  });
}
