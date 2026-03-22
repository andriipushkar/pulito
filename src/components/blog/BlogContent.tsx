interface BlogContentProps {
  content: string;
}

/**
 * Renders blog post HTML content.
 * IMPORTANT: Content must be sanitized server-side before storing in the database.
 * The blog service should use a library like DOMPurify or sanitize-html
 * when creating/updating posts to prevent XSS attacks.
 */
export default function BlogContent({ content }: BlogContentProps) {
  return (
    <div
      className="prose prose-lg max-w-none
        prose-headings:font-bold prose-headings:text-[var(--color-text)]
        prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-2xl
        prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-xl
        prose-p:mb-4 prose-p:leading-relaxed prose-p:text-[var(--color-text-secondary)]
        prose-a:text-[var(--color-primary)] prose-a:underline hover:prose-a:text-[var(--color-primary-dark)]
        prose-img:rounded-[var(--radius)] prose-img:shadow-[var(--shadow-sm)]
        prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6
        prose-li:mb-2 prose-li:text-[var(--color-text-secondary)]
        prose-blockquote:border-l-4 prose-blockquote:border-[var(--color-primary)] prose-blockquote:pl-4 prose-blockquote:italic
        prose-code:rounded prose-code:bg-[var(--color-bg-secondary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm
        prose-pre:rounded-[var(--radius)] prose-pre:bg-[var(--color-bg-secondary)] prose-pre:p-4
        prose-table:w-full prose-th:border prose-th:border-[var(--color-border)] prose-th:bg-[var(--color-bg-secondary)] prose-th:p-2
        prose-td:border prose-td:border-[var(--color-border)] prose-td:p-2"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
