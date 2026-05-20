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
  google_maps_api_key: string;
  google_business_place_id: string;
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
  google_maps_api_key: '',
  google_business_place_id: '',
};

export type SettingsKey = keyof SiteSettings;
