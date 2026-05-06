import { getSettings } from '@/services/settings';
import { cacheGet, cacheSet, CACHE_TTL } from '@/services/cache';

/**
 * Google Business Profile інтеграція через Google Maps Places API.
 *
 * Ми використовуємо Place Details API (publicly accessible with API key — без OAuth)
 * замість Business Profile API, який вимагає повний GBP OAuth flow та верифікованого
 * власника. Place Details дає те, що потрібно бізнесу: рейтинг, кількість відгуків,
 * до 5 останніх відгуків і години роботи.
 *
 * Налаштовується двома значеннями в SiteSettings:
 *  - google_maps_api_key — Google Cloud API key з увімкненим Places API
 *  - google_business_place_id — ChIJ... ідентифікатор закладу (отримується через
 *    Place ID Finder: https://developers.google.com/maps/documentation/javascript/place-id)
 */

export class GoogleBusinessError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'GoogleBusinessError';
  }
}

export interface GoogleReview {
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  timestamp: number;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  rating: number | null;
  totalRatings: number | null;
  url: string | null;
  reviewUrl: string | null;
  phoneNumber: string | null;
  website: string | null;
  reviews: GoogleReview[];
}

interface GoogleApiResponse {
  status: string;
  error_message?: string;
  result?: {
    name?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    formatted_phone_number?: string;
    website?: string;
    reviews?: Array<{
      author_name: string;
      profile_photo_url?: string;
      rating: number;
      text: string;
      relative_time_description: string;
      time: number;
    }>;
  };
}

const CACHE_KEY = 'gbp:place_details';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

interface Config {
  apiKey: string;
  placeId: string;
}

async function getConfig(): Promise<Config> {
  const settings = await getSettings();
  const apiKey = settings.google_maps_api_key?.trim();
  const placeId = settings.google_business_place_id?.trim();

  if (!apiKey) {
    throw new GoogleBusinessError(
      'Google Maps API key не налаштований (settings.google_maps_api_key)',
      503,
    );
  }
  if (!placeId) {
    throw new GoogleBusinessError(
      'Google Place ID не налаштований (settings.google_business_place_id)',
      503,
    );
  }
  return { apiKey, placeId };
}

export async function isConfigured(): Promise<boolean> {
  try {
    await getConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch place details (rating, reviews, hours) from Google Maps Places API.
 * Cached for 1 hour to avoid burning API quota — Google charges per call.
 */
export async function getPlaceDetails(force = false): Promise<PlaceDetails> {
  if (!force) {
    const cached = await cacheGet<PlaceDetails>(CACHE_KEY).catch(() => null);
    if (cached) return cached;
  }

  const { apiKey, placeId } = await getConfig();

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    language: 'uk',
    fields: [
      'name',
      'formatted_address',
      'rating',
      'user_ratings_total',
      'reviews',
      'url',
      'formatted_phone_number',
      'website',
    ].join(','),
  });

  const res = await fetch(`${PLACE_DETAILS_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new GoogleBusinessError(`Google Places API повернув ${res.status}`, 502);
  }

  const data = (await res.json()) as GoogleApiResponse;
  if (data.status !== 'OK') {
    throw new GoogleBusinessError(
      `Google Places API: ${data.status}${data.error_message ? ` (${data.error_message})` : ''}`,
      502,
    );
  }
  const result = data.result;
  if (!result) {
    throw new GoogleBusinessError('Google Places API не повернув даних', 502);
  }

  const reviews: GoogleReview[] = (result.reviews ?? []).map((r) => ({
    authorName: r.author_name,
    authorPhotoUrl: r.profile_photo_url ?? null,
    rating: r.rating,
    text: r.text,
    relativeTime: r.relative_time_description,
    timestamp: r.time,
  }));

  // Sort reviews by recency (most recent first)
  reviews.sort((a, b) => b.timestamp - a.timestamp);

  const details: PlaceDetails = {
    placeId,
    name: result.name ?? '',
    formattedAddress: result.formatted_address ?? null,
    rating: typeof result.rating === 'number' ? result.rating : null,
    totalRatings: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
    url: result.url ?? null,
    reviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
    phoneNumber: result.formatted_phone_number ?? null,
    website: result.website ?? null,
    reviews,
  };

  await cacheSet(CACHE_KEY, details, CACHE_TTL.LONG).catch(() => {});
  return details;
}

/**
 * Build a "Залишити відгук" URL clients can be sent to.
 * Works without API key — just needs the Place ID.
 */
export async function getWriteReviewUrl(): Promise<string | null> {
  const settings = await getSettings();
  const placeId = settings.google_business_place_id?.trim();
  if (!placeId) return null;
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}
