import type { Metadata } from "next";
import { Inter, Handlee } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });
const hando = Handlee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hando"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://kachabiti.tn"),
  title: "Kachabiti - Handcrafted Traditional Products | Premium Quality",
  description: "Discover authentic handcrafted traditional products at Kachabiti. Premium quality HBarnous ROSSINI, Serviette de table, and unique handmade items. 100% authentic craftsmanship.",
  keywords: "handcrafted, traditional products, HBarnous ROSSINI, Serviette de table, artisan, handmade, premium quality, Tunisia, traditional wear, home accessories",
  authors: [{ name: "Kachabiti" }],
  creator: "Kachabiti",
  publisher: "Kachabiti",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kachabiti.tn",
    siteName: "Kachabiti",
    title: "Kachabiti - Handcrafted Traditional Products",
    description: "Discover authentic handcrafted traditional products at Kachabiti. Premium quality HBarnous ROSSINI, Serviette de table, and unique handmade items.",
    images: [
      {
        url: "/assets/images/logoKachabity.jpg",
        width: 1200,
        height: 630,
        alt: "Kachabiti - Handcrafted Traditional Products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kachabiti - Handcrafted Traditional Products",
    description: "Discover authentic handcrafted traditional products at Kachabiti. Premium quality HBarnous ROSSINI, Serviette de table, and unique handmade items.",
    images: ["/assets/images/logoKachabity.jpg"],
  },
  alternates: {
    canonical: "https://artisan-kraiem.com",
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set by middleware.ts for localized routes; admin and API docs are English.
  const lang = (await headers()).get("x-locale") ?? "en";
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Kachabiti",
              url: "https://kachabiti.tn",
              logo: "https://kachabiti.tn/assets/images/logo.svg",
              description: "Premium handcrafted traditional products and authentic artisan goods",
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+216 55 558 648",
                contactType: "customer service",
              },
              address: {
                "@type": "PostalAddress",
                addressCountry: "TN",
                addressLocality: "Tunisia",
              },
              sameAs: [
                "https://www.facebook.com/profile.php?id=61562718525332",
                "https://www.instagram.com/kachabitii/",
                "https://www.tiktok.com/@kachabitii",
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.className} ${hando.variable}`} suppressHydrationWarning>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              success: {
                style: {
                  // background: '#7a3b2e',
                  color: '#0000000',
                },
              },
              error: {
                style: {
                  // background: '#ef4444',
                  // color: '#fff',
                  color: '#0000000',
                },
              },
            }}
          />
      </body>
    </html>
  );
}