'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getAccessToken } from '@/lib/api-client';

interface ReviewUser {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

interface Review {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  pros: string | null;
  cons: string | null;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  adminReply: string | null;
  adminReplyAt: string | null;
  createdAt: string;
  user: ReviewUser;
}

interface RatingStats {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

interface ReviewsResponse {
  reviews: Review[];
  stats: RatingStats;
  total: number;
  page: number;
  limit: number;
}

type SortOption = 'newest' | 'helpful' | 'rating_high' | 'rating_low';

interface ReviewSectionProps {
  productId: number;
}

function StarIcon({ filled, half, size = 20 }: { filled: boolean; half?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {half ? (
        <>
          <defs>
            <linearGradient id={`half-star-${size}`}>
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#E5E7EB" />
            </linearGradient>
          </defs>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={`url(#half-star-${size})`}
          />
        </>
      ) : (
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={filled ? '#F59E0B' : '#E5E7EB'}
        />
      )}
    </svg>
  );
}

function StarRating({ rating, size = 20 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<StarIcon key={i} filled size={size} />);
    } else if (i === Math.ceil(rating) && rating % 1 >= 0.3) {
      stars.push(<StarIcon key={i} filled={false} half size={size} />);
    } else {
      stars.push(<StarIcon key={i} filled={false} size={size} />);
    }
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

function InteractiveStarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <StarIcon filled={star <= (hoverRating || rating)} size={28} />
        </button>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ReviewSection({ productId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [helpedIds, setHelpedIds] = useState<Set<number>>(new Set());

  // Form state
  const [formRating, setFormRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formPros, setFormPros] = useState('');
  const [formCons, setFormCons] = useState('');

  const limit = 10;
  const isLoggedIn = !!getAccessToken();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ReviewsResponse>(
        `/api/v1/products/${productId}/reviews?page=${page}&limit=${limit}&sort=${sort}`
      );
      if (res.success && res.data) {
        setReviews(res.data.reviews);
        setStats(res.data.stats);
        setTotal(res.data.total);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [productId, page, sort]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRating === 0) {
      setSubmitError('Будь ласка, оберіть оцінку');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await apiClient.post(`/api/v1/products/${productId}/reviews`, {
        rating: formRating,
        title: formTitle || undefined,
        comment: formComment || undefined,
        pros: formPros || undefined,
        cons: formCons || undefined,
      });

      if (res.success) {
        setSubmitSuccess(true);
        setShowForm(false);
        setFormRating(0);
        setFormTitle('');
        setFormComment('');
        setFormPros('');
        setFormCons('');
        // Re-fetch after a short delay to let moderation pipeline process
        setTimeout(() => fetchReviews(), 500);
      } else {
        setSubmitError(res.error || 'Помилка при надсиланні відгуку');
      }
    } catch {
      setSubmitError('Помилка при надсиланні відгуку');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: number) => {
    if (helpedIds.has(reviewId)) return;
    try {
      const res = await apiClient.post(`/api/v1/reviews/${reviewId}/helpful`);
      if (res.success) {
        setHelpedIds((prev) => new Set(prev).add(reviewId));
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r))
        );
      }
    } catch {
      // silently fail
    }
  };

  const totalPages = Math.ceil(total / limit);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Найновіші' },
    { value: 'helpful', label: 'Найкорисніші' },
    { value: 'rating_high', label: 'Висока оцінка' },
    { value: 'rating_low', label: 'Низька оцінка' },
  ];

  return (
    <div className="mt-10">
      <h2 className="relative mb-6 text-lg font-bold">
        Відгуки
        {stats && stats.totalReviews > 0 && (
          <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">
            ({stats.totalReviews})
          </span>
        )}
        <span className="absolute -bottom-1 left-0 h-0.5 w-10 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]" />
      </h2>

      {/* Rating Summary */}
      {stats && stats.totalReviews > 0 && (
        <div className="mb-6 flex flex-col gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow)] sm:flex-row sm:items-center">
          {/* Average rating */}
          <div className="flex flex-col items-center gap-1 sm:min-w-[140px]">
            <span className="text-4xl font-bold text-[var(--color-text)]">{stats.averageRating}</span>
            <StarRating rating={stats.averageRating} size={22} />
            <span className="text-xs text-[var(--color-text-secondary)]">
              {stats.totalReviews} {stats.totalReviews === 1 ? 'відгук' : stats.totalReviews < 5 ? 'відгуки' : 'відгуків'}
            </span>
          </div>

          {/* Distribution bars */}
          <div className="flex flex-1 flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star] || 0;
              const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-right text-[var(--color-text-secondary)]">{star}</span>
                  <StarIcon filled size={14} />
                  <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-bg-secondary)] h-2">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-[var(--color-text-secondary)]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="review-sort" className="text-sm text-[var(--color-text-secondary)]">
            Сортувати:
          </label>
          <select
            id="review-sort"
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {isLoggedIn && !submitSuccess && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] active:scale-[0.98]"
          >
            {showForm ? 'Скасувати' : 'Написати відгук'}
          </button>
        )}
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Дякуємо за ваш відгук! Він з&apos;явиться після модерації.
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow)]">
          <h3 className="mb-4 text-base font-semibold">Залишити відгук</h3>

          {submitError && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</div>
          )}

          {/* Rating */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Оцінка *</label>
            <InteractiveStarRating rating={formRating} onChange={setFormRating} />
          </div>

          {/* Title */}
          <div className="mb-3">
            <label htmlFor="review-title" className="mb-1 block text-sm font-medium">Заголовок</label>
            <input
              id="review-title"
              type="text"
              maxLength={200}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Коротко про враження"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Comment */}
          <div className="mb-3">
            <label htmlFor="review-comment" className="mb-1 block text-sm font-medium">Коментар</label>
            <textarea
              id="review-comment"
              maxLength={2000}
              rows={4}
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="Розкажіть детальніше про свій досвід"
              className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Pros / Cons */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="review-pros" className="mb-1 block text-sm font-medium text-[var(--color-success)]">
                Переваги
              </label>
              <textarea
                id="review-pros"
                maxLength={500}
                rows={2}
                value={formPros}
                onChange={(e) => setFormPros(e.target.value)}
                placeholder="Що сподобалось?"
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label htmlFor="review-cons" className="mb-1 block text-sm font-medium text-[var(--color-danger)]">
                Недоліки
              </label>
              <textarea
                id="review-cons"
                maxLength={500}
                rows={2}
                value={formCons}
                onChange={(e) => setFormCons(e.target.value)}
                placeholder="Що не сподобалось?"
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Надсилання...' : 'Надіслати відгук'}
          </button>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center">
          <p className="text-[var(--color-text-secondary)]">Поки що немає відгуків</p>
          {isLoggedIn && !showForm && !submitSuccess && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              Будьте першим, хто залишить відгук
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow)] transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              {/* Header */}
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-sm font-semibold text-[var(--color-primary)]">
                    {review.user.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={review.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      review.user.fullName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{review.user.fullName}</span>
                      {review.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          Підтверджена покупка
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
                <StarRating rating={review.rating} size={16} />
              </div>

              {/* Title */}
              {review.title && (
                <h4 className="mb-2 text-sm font-semibold">{review.title}</h4>
              )}

              {/* Comment */}
              {review.comment && (
                <p className="mb-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">{review.comment}</p>
              )}

              {/* Pros / Cons */}
              {(review.pros || review.cons) && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {review.pros && (
                    <div className="rounded-lg bg-green-50 px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-green-700">Переваги</span>
                      <p className="text-sm text-green-800">{review.pros}</p>
                    </div>
                  )}
                  {review.cons && (
                    <div className="rounded-lg bg-red-50 px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-red-700">Недоліки</span>
                      <p className="text-sm text-red-800">{review.cons}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Admin reply */}
              {review.adminReply && (
                <div className="mb-3 rounded-lg border-l-3 border-[var(--color-primary)] bg-[var(--color-primary-50)] px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-primary)]">Відповідь магазину</span>
                    {review.adminReplyAt && (
                      <span className="text-[11px] text-[var(--color-text-secondary)]">{formatDate(review.adminReplyAt)}</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{review.adminReply}</p>
                </div>
              )}

              {/* Helpful button */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleHelpful(review.id)}
                  disabled={helpedIds.has(review.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60 disabled:cursor-default"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 22V11l5-9 1.5 1-1 5h7.5a2 2 0 011.94 2.49l-1.75 7A2 2 0 0118.25 19H7zM4 11H2v11h2V11z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Корисно{review.helpfulCount > 0 && ` (${review.helpfulCount})`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="px-2 text-sm text-[var(--color-text-secondary)]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Далі
          </button>
        </div>
      )}
    </div>
  );
}
