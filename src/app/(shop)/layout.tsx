import AuthProvider from '@/providers/AuthProvider';
import CartProvider from '@/providers/CartProvider';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CallbackButton from '@/components/common/CallbackButton';
import ChatWidget from '@/components/common/ChatWidget';
import BackToTop from '@/components/ui/BackToTop';
import AriaLiveRegion from '@/components/ui/AriaLiveRegion';
import { getCategories } from '@/services/category';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <AuthProvider>
      <CartProvider>
        <Header categories={categories} />
        <main id="main-content" className="min-h-[60vh] animate-fade-in-up">{children}</main>
        <Footer />
        <CallbackButton />
        <BackToTop />
        <ChatWidget />
        <AriaLiveRegion />
      </CartProvider>
    </AuthProvider>
  );
}
