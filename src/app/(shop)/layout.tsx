import AuthProvider from '@/providers/AuthProvider';
import CartProvider from '@/providers/CartProvider';
import SettingsProvider from '@/providers/SettingsProvider';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import BackToTop from '@/components/ui/BackToTop';
import AriaLiveRegion from '@/components/ui/AriaLiveRegion';
import { getCategories } from '@/services/category';
import { getSettings } from '@/services/settings';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([
    getCategories(),
    getSettings(),
  ]);

  return (
    <AuthProvider>
      <CartProvider>
        <SettingsProvider settings={settings}>
          <div className="flex min-h-screen flex-col">
          <Header categories={categories} />
          <main id="main-content" className="flex-1 animate-fade-in-up">{children}</main>
          <Footer />
          </div>
          <MobileBottomNav categories={categories} />
          <BackToTop />
          <AriaLiveRegion />
        </SettingsProvider>
      </CartProvider>
    </AuthProvider>
  );
}
