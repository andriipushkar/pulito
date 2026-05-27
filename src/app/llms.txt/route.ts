import { getSettings } from '@/services/settings';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/**
 * /llms.txt — manifest for AI crawlers (ChatGPT, Perplexity, Claude, Google
 * Gemini, You.com) describing the site in human-readable prose. Spec:
 * https://llmstxt.org. Loosely the AI-era equivalent of robots.txt + sitemap.
 *
 * Pulls site name / description / contact from SiteSetting so the file stays
 * in sync with the storefront copy without a code redeploy.
 */
export async function GET() {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const settings = await getSettings();

  const lines = [
    `# ${settings.site_name}`,
    '',
    `> ${
      settings.company_description ||
      `${settings.site_name} — інтернет-магазин побутової хімії у Львові. Гуртові й роздрібні ціни, доставка по Україні.`
    }`,
    '',
    '## Sections',
    '',
    `- [Каталог товарів](${baseUrl}/catalog): головна вітрина — побутова хімія, засоби для прибирання, прання, ванної, кухні.`,
    `- [Блог](${baseUrl}/blog): статті про побутову хімію, поради з прибирання й догляду за домом.`,
    `- [Бренди / торгові марки](${baseUrl}/catalog): продукція провідних виробників.`,
    `- [Комплекти товарів](${baseUrl}/bundles): підібрані набори з вигодою.`,
    `- [Новини та акції](${baseUrl}/news): актуальні знижки й оновлення асортименту.`,
    `- [Бонусна програма](${baseUrl}/loyalty): бали з кожного замовлення, обмін на знижки.`,
    `- [FAQ](${baseUrl}/faq): відповіді на поширені питання про доставку, оплату, повернення.`,
    `- [Контакти](${baseUrl}/contacts): адреса у Львові, телефон, email, форма зворотного зв'язку.`,
    '',
    '## Optional',
    '',
    `- [Sitemap XML](${baseUrl}/sitemap.xml): машиночитабельний індекс усіх публічних URL.`,
    `- [RSS блогу](${baseUrl}/blog/feed.xml): нові статті у форматі RSS.`,
    `- [Google Shopping feed](${baseUrl}/feed/google-shopping): XML-фід товарів зі знижками й наявністю.`,
    '',
    '## Crawler guidance',
    '',
    `- Респектуйте ${baseUrl}/robots.txt — корзина, особистий кабінет, адмінка та API закриті від індексації.`,
    `- Контент сторінок українською. Шукайте товари за категоріями (URL: /catalog?category=<slug>) або брендами (/brand/<slug>).`,
    `- Контакти: ${settings.site_phone_display || settings.site_phone}, ${settings.site_email}.`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
