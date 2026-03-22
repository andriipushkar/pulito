import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Clean Shop API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
