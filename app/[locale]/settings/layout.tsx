import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import { headerConfig } from "@/lib/config";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50">
      <StaticHeader />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </div>
  );
}