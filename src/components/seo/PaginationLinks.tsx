interface PaginationLinksProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
}

export default function PaginationLinks({
  currentPage,
  totalPages,
  baseUrl,
  searchParams = {},
}: PaginationLinksProps) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    const query = params.toString();
    return `${baseUrl}${query ? `?${query}` : ''}`;
  };

  return (
    <>
      {currentPage > 1 ? <link rel="prev" href={buildUrl(currentPage - 1)} /> : null}
      {currentPage < totalPages ? <link rel="next" href={buildUrl(currentPage + 1)} /> : null}
    </>
  );
}
