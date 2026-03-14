/** Default page sizes for admin list pages */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/** Polling intervals in ms */
export const ORDER_STATS_POLL_INTERVAL = 30_000;
export const DASHBOARD_REFRESH_INTERVAL = 30_000;

/** Wholesale group IDs */
export const WHOLESALE_GROUPS = {
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 3,
} as const;

/** Allowed order status transitions */
export const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
  new_order: ['processing', 'cancelled'],
  processing: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'shipped', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed', 'returned'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};

/** Toast auto-dismiss duration in ms */
export const TOAST_DURATION = 4_000;
export const ACTION_RESULT_DURATION = 3_000;

/** Search debounce delay in ms */
export const SEARCH_DEBOUNCE_MS = 400;

/** Upload limits */
export const MAX_IMAGE_SIZE_MB = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** TTN (Nova Poshta tracking number) validation */
export const TTN_PATTERN = /^\d{14}$/;
export const TTN_PLACEHOLDER = '20450000000000';

/** IBAN validation (Ukrainian) */
export const IBAN_UA_PATTERN = /^UA\d{27}$/;

/** EDRPOU validation */
export const EDRPOU_PATTERN = /^\d{8}$/;

/** IPN validation */
export const IPN_PATTERN = /^\d{10}(\d{2})?$/;

/** Phone validation (Ukrainian) */
export const PHONE_UA_PATTERN = /^\+380\d{9}$/;

/** SEO limits */
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;
