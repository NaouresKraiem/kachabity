import supabase from "@/lib/supabaseClient";
import { cachedCatalogQuery } from "@/lib/catalog-cache";
import HeroSection from "@/components/sections/HeroSection";
import TopProducts from "@/components/products/TopProducts";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Suspense } from "react";
import PromoProducts from "@/components/products/PromoProducts";
import CustomerFeedback from "@/components/reviews/CustomerFeedback";
import SaleBanner from "@/components/sections/SaleBanner";
import Reels from "@/components/sections/Reels";
import ServiceHighlights from "@/components/services/ServiceHighlights";
import ProductGrid from "@/components/products/ProductGrid";
import FAQ from "@/components/sections/FAQ";
import ProductShowcase from "@/components/landing/ProductShowcase";
import NewArrivals from "@/components/landing/NewArrivals";
import CollectionSpotlight from "@/components/landing/CollectionSpotlight";
import HowToOrder from "@/components/landing/HowToOrder";
import { getNewArrivals, getProductsBySlugs, getSpotlightCollection, type LandingProduct, type SpotlightCollection } from "@/lib/landing-products";
import { getSiteSettings } from "@/lib/get-site-settings";
import { getFeaturedCategories, getTopProducts, getPromoProducts, getSaleBanners, getReels, getLatestReviews } from "@/lib/home-data";

// The hero carousel is hidden until it has its own images; the product showcase leads the page meanwhile.
const SHOW_HERO_CAROUSEL = false;

// Pieces shown in the product showcase: a kachabia, a dengri and a burnous.
const SHOWCASE_SLUGS = [
  "kachabia-wazra-tibar-7018",
  "dengri-tunisien-homme-240",
  "burnous-tunisien-laine-232",
];

interface LandingData {
  showcase: LandingProduct[];
  newArrivals: LandingProduct[];
  spotlight: SpotlightCollection | null;
  freeShippingThreshold: number | null;
}

async function loadLandingData(locale: string): Promise<LandingData> {
  const [showcase, newArrivals, spotlight, settings] = await Promise.all([
    getProductsBySlugs(locale, SHOWCASE_SLUGS),
    getNewArrivals(locale, 10),
    getSpotlightCollection(locale),
    getSiteSettings(),
  ]);
  return {
    showcase,
    newArrivals,
    spotlight,
    freeShippingThreshold: settings.free_shipping_enabled ? settings.global_free_shipping_threshold : null,
  };
}

// Product-driven landing sections, cached under the catalog tag like the hero rows.
// Errors are caught outside the cache so a failed load isn't cached.
async function getLandingData(locale: string): Promise<LandingData> {
  try {
    return await cachedCatalogQuery(`landing-v2-${locale}`, () => loadLandingData(locale))();
  } catch (error) {
    console.error('Error fetching landing page data:', error);
    return { showcase: [], newArrivals: [], spotlight: null, freeShippingThreshold: null };
  }
}

// Hero rows change rarely (edited in the Supabase dashboard): serve them from the Next.js data cache.
const getHeroContent = cachedCatalogQuery("hero-content", async () => {
  const [heroResult, smallCardsResult] = await Promise.all([
    supabase.from("hero_sections").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("small_cards").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
  ]);
  return { heroData: heroResult.data || [], smallCardsData: smallCardsResult.data || [] };
});

async function HeroContent({ locale }: { locale: string }) {
  try {
    const { heroData, smallCardsData } = await getHeroContent();

    return (
      <HeroSection
        heroData={heroData}
        smallCardsData={smallCardsData}
      />
    );
  } catch (error) {
    console.error('Error fetching hero data:', error);
    const errorMessages = {
      en: {
        welcome: "Welcome to our traditional store",
        discover: "Discover our amazing handcrafted products"
      },
      fr: {
        welcome: "Bienvenue dans notre magasin traditionnel",
        discover: "Découvrez nos produits artisanaux étonnants"
      },
      ar: {
        welcome: "مرحباً بكم في متجرنا التقليدي",
        discover: "اكتشف منتجاتنا الحرفية الرائعة"
      }
    };
    const t = errorMessages[locale as keyof typeof errorMessages] || errorMessages.en;
    return (
      <div className="w-full py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-[#2b1a16] mb-4">
            {t.welcome}
          </h2>
          <p className="text-[#7a3b2e]">
            {t.discover}
          </p>
        </div>
      </div>
    );
  }
}

// Each section falls back to fetching in the browser if its server data failed to load.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are passed straight to the section components
async function getHomeSections(): Promise<Record<'categories' | 'topProducts' | 'promoProducts' | 'saleBanners' | 'reels' | 'reviews', any>> {
  const settle = async <T,>(p: Promise<T>) => { try { return await p; } catch (error) { console.error('Home section data failed:', error); return undefined; } };
  const [categories, top, promo, saleBanners, reels, reviews] = await Promise.all([
    settle(getFeaturedCategories()),
    settle(getTopProducts()),
    settle(getPromoProducts()),
    settle(getSaleBanners()),
    settle(getReels()),
    settle(getLatestReviews()),
  ]);
  return { categories, topProducts: top?.products, promoProducts: promo?.products, saleBanners, reels, reviews };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = requestedLocale || 'ar';
  // All home sections come from the Next.js data cache and render in the first HTML
  // (instead of each section fetching after hydration).
  const [landing, home] = await Promise.all([getLandingData(locale), getHomeSections()]);

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-white">
        {SHOW_HERO_CAROUSEL && <HeroContent locale={locale} />}
        <ProductShowcase
          locale={locale}
          products={landing.showcase}
          collectionSlug={landing.spotlight?.slug ?? null}
          freeShippingThreshold={landing.freeShippingThreshold}
        />
        <Suspense fallback={<LoadingSpinner />}>
          <ServiceHighlights />
          <ProductGrid locale={locale} initialCategories={home.categories} />
          <NewArrivals locale={locale} products={landing.newArrivals} />
          <TopProducts locale={locale} initialProducts={home.topProducts} />
          <CollectionSpotlight locale={locale} collection={landing.spotlight} />
          <PromoProducts locale={locale} initialProducts={home.promoProducts} />
          <SaleBanner initialPromotions={home.saleBanners} />
          <Reels initialReels={home.reels} />
          <CustomerFeedback initialReviews={home.reviews} />
          <HowToOrder locale={locale} freeShippingThreshold={landing.freeShippingThreshold} />
          <FAQ />
        </Suspense>
      </main>
    </ErrorBoundary>
  );
}