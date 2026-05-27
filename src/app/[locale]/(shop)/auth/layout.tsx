import Container from '@/components/ui/Container';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md">{children}</div>
    </Container>
  );
}
