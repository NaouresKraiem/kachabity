import supabase from "@/lib/supabaseClient";
import StaticHeader from "@/components/layout/StaticHeader";
import HeroSection from "@/components/sections/HeroSection";
import TopProducts from "@/components/products/TopProducts";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Footer from "@/components/footer/Footer";
import { Suspense } from "react";
import PromoProducts from "@/components/products/PromoProducts";
import CustomerFeedback from "@/components/reviews/CustomerFeedback";
import SaleBanner from "@/components/sections/SaleBanner";
import ServiceHighlights from "@/components/services/ServiceHighlights";
import ProductGrid from "@/components/products/ProductGrid";

async function HeroContent() {
  try {
    const [heroResult, smallCardsResult] = await Promise.all([
      supabase
        .from("hero_sections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),

      supabase
        .from("small_cards")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    ]);

    return (
      <HeroSection
        heroData={heroResult.data || []}
        smallCardsData={smallCardsResult.data || []}
      />
    );
  } catch (error) {
    console.error('Error fetching hero data:', error);
    return (
      <div className="w-full py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-[#2b1a16] mb-4">
            Welcome to our traditional store
          </h2>
          <p className="text-[#7a3b2e]">
            Discover our amazing handcrafted products
          </p>
        </div>
      </div>
    );
  }
}

export default async function Home({ params }: { params: { locale: string } }) {
  const locale = params.locale || 'en';

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-white">
        <StaticHeader />
        <HeroContent />
        <Suspense fallback={<LoadingSpinner />}>
          <ServiceHighlights />
          <ProductGrid locale={locale} />
          <TopProducts locale={locale} />
          <PromoProducts locale={locale} />
          <SaleBanner />
          <CustomerFeedback />
        </Suspense>
        <Footer />
      </main>
    </ErrorBoundary>
  );
}