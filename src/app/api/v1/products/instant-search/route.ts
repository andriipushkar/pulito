export const runtime = 'edge';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'localhost';
const TYPESENSE_PORT = process.env.TYPESENSE_PORT || '8108';
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY || 'ts-clean-dev-key';
const TYPESENSE_PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'http';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (q.length < 2) {
    return Response.json({ success: true, data: [] });
  }

  try {
    const tsUrl = `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/collections/products/documents/search`;
    const params = new URLSearchParams({
      q,
      query_by: 'name,code,categoryName',
      filter_by: 'isActive:true',
      sort_by: '_text_match:desc,ordersCount:desc',
      per_page: '8',
      prefix: 'true,true,false',
      num_typos: '1',
      highlight_full_fields: 'name',
    });

    const res = await fetch(`${tsUrl}?${params}`, {
      headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return Response.json({ success: true, data: [] });
    }

    const data = await res.json();
    const hits = (data.hits || []).map((hit: { document: Record<string, unknown> }) => ({
      id: Number(hit.document.id),
      name: hit.document.name,
      code: hit.document.code,
      slug: hit.document.slug,
      priceRetail: hit.document.priceRetail,
      imagePath: hit.document.imagePath || null,
      categoryName: hit.document.categoryName || null,
    }));

    return Response.json({ success: true, data: hits });
  } catch {
    // Typesense unavailable — return empty, frontend falls back to /products/search
    return Response.json({ success: true, data: [] });
  }
}
