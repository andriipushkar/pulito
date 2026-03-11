import AuthProvider from '@/providers/AuthProvider';
import CartProvider from '@/providers/CartProvider';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import BackToTop from '@/components/ui/BackToTop';
import AriaLiveRegion from '@/components/ui/AriaLiveRegion';
import { getCategories } from '@/services/category';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <AuthProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col">
        <Header categories={categories} />
        <main id="main-content" className="flex-1 animate-fade-in-up">{children}</main>
        <Footer />
        </div>
        <MobileBottomNav categories={categories} />
        <BackToTop />
        <AriaLiveRegion />
      </CartProvider>
    </AuthProvider>
  );
}
