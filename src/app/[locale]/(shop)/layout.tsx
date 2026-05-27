import dynamic from 'next/dynamic';
import CartProvider from '@/providers/CartProvider';
import SettingsProvider from '@/providers/SettingsProvider';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import BackToTop from '@/components/ui/BackToTop';
import AriaLiveRegion from '@/components/ui/AriaLiveRegion';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import UtmTracker from '@/components/UtmTracker';
import { getCategories } from '@/services/category';
import { getSettings } from '@/services/settings';

// Chat widget loaded client-side only — no SSR cost, no impact on LCP.
const ChatWidget = dynamic(() => import('@/components/chatbot/ChatWidget'));

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);

  return (
    <CartProvider>
      <SettingsProvider settings={settings}>
        <div className="flex min-h-screen flex-col">
          <Header categories={categories} />
          <main id="main-content" className="flex-1 animate-fade-in-up">
            {children}
          </main>
          <Footer settings={settings} />
        </div>
        <MobileBottomNav categories={categories} />
        <BackToTop />
        <AriaLiveRegion />
        <PageViewTracker />
        <UtmTracker />
        <ChatWidget />
      </SettingsProvider>
    </CartProvider>
  );
}
