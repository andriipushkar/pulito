export const metadata = {
  title: 'API Documentation — Clean Shop',
  description: 'REST API documentation for Clean Shop e-commerce platform',
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
