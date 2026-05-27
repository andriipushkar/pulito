export interface SiteSettings {
  site_name: string;
  site_phone: string;
  site_phone_display: string;
  site_email: string;
  site_address: string;
  working_hours: string;
  free_delivery_threshold: string;
  social_telegram: string;
  social_viber: string;
  social_instagram: string;
  social_facebook: string;
  social_tiktok: string;
  maintenance_mode: string;
  company_description: string;
  company_legal_name: string;
  company_edrpou: string;
  company_ipn: string;
  company_iban: string;
  company_bank: string;
  company_legal_address: string;
  default_seo_title: string;
  default_seo_description: string;
  google_analytics_id: string;
  facebook_pixel_id: string;
  pinterest_tag_id: string;
  pinterest_domain_verify: string;
  google_maps_api_key: string;
  google_business_place_id: string;
  // '1' → hide quantity on the storefront for every product; '0' → show
  // exact count (per-product hideQuantity flag is still respected).
  hide_all_quantity: string;
  // AI / LLM provider keys for product description & SEO generation.
  // Empty values fall back to process.env (ANTHROPIC_API_KEY / GEMINI_API_KEY / GEMINI_MODEL).
  anthropic_api_key: string;
  gemini_api_key: string;
  gemini_model: string;
  // Loyalty / referral bonus amounts (in loyalty points; 1 point ≈ 1 ₴).
  // "0" disables the corresponding bonus. Values are stored as strings to
  // match the rest of SiteSettings — services parse with Number().
  loyalty_welcome_bonus: string; // points credited to any new user on registration
  referral_referrer_bonus: string; // points credited to referrer when referee makes 1st order
  referral_referee_bonus: string; // points credited to referee on registration if they used a ref code
  loyalty_max_redemption_percent: string; // 0-100. Max % of order (items+delivery) payable with points.
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'Pulito Trade',
  site_phone: '+380001234567',
  site_phone_display: '+38 (000) 123-45-67',
  site_email: 'info@pulito.trade',
  site_address: 'м. Київ, вул. Хрещатик, 1',
  working_hours: 'Пн-Пт: 9:00 - 18:00, Сб: 10:00 - 15:00',
  free_delivery_threshold: '2000',
  social_telegram: '',
  social_viber: '',
  social_instagram: '',
  social_facebook: '',
  social_tiktok: '',
  maintenance_mode: 'false',
  company_description: '',
  company_legal_name: '',
  company_edrpou: '',
  company_ipn: '',
  company_iban: '',
  company_bank: '',
  company_legal_address: '',
  default_seo_title: 'Pulito Trade — інтернет-магазин побутової хімії',
  default_seo_description:
    'Купуйте побутову хімію онлайн з доставкою по Україні. Великий вибір засобів для прання, миття посуду, прибирання та особистої гігієни.',
  google_analytics_id: '',
  facebook_pixel_id: '',
  pinterest_tag_id: '',
  pinterest_domain_verify: '',
  google_maps_api_key: '',
  google_business_place_id: '',
  hide_all_quantity: '0',
  anthropic_api_key: '',
  gemini_api_key: '',
  gemini_model: 'gemini-2.5-flash',
  loyalty_welcome_bonus: '50',
  referral_referrer_bonus: '100',
  referral_referee_bonus: '50',
  loyalty_max_redemption_percent: '50',
};

export type SettingsKey = keyof SiteSettings;
