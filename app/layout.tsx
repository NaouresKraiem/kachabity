import type { Metadata } from "next";
import { Inter, Handlee } from "next/font/google";
import "./globals.css";
import '@ant-design/v5-patch-for-react-19';
import { ConfigProvider } from 'antd';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });
const hando = Handlee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hando"
});

export const metadata: Metadata = {
  title: "Artisan by Kraiem - Handcrafted Traditional Products | Premium Quality",
  description: "Discover authentic handcrafted traditional products at Artisan by Kraiem. Premium quality HBarnous ROSSINI, Serviette de table, and unique handmade items. 100% authentic craftsmanship.",
  keywords: "handcrafted, traditional products, HBarnous ROSSINI, Serviette de table, artisan, handmade, premium quality, Tunisia, traditional wear, home accessories",
  authors: [{ name: "Artisan by Kraiem" }],
  creator: "Artisan by Kraiem",
  publisher: "Artisan by Kraiem",
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
    url: "https://artisan-kraiem.com",
    siteName: "Artisan by Kraiem",
    title: "Artisan by Kraiem - Handcrafted Traditional Products",
    description: "Discover authentic handcrafted traditional products at Artisan by Kraiem. Premium quality HBarnous ROSSINI, Serviette de table, and unique handmade items.",
    images: [
      {
        url: "/assets/images/hero/hbarnous-rossini.jpg",
        width: 1200,
        height: 630,
        alt: "Artisan by Kraiem - Handcrafted Traditional Products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Artisan by Kraiem - Handcrafted Traditional Products",
    description: "Discover authentic handcrafted traditional products at Artisan by Kraiem. Premium quality HBarnous ROSSINI, Serviette de table, and unique handmade items.",
    images: ["/assets/images/hero/hbarnous-rossini.jpg"],
  },
  alternates: {
    canonical: "https://artisan-kraiem.com",
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Artisan by Kraiem",
              url: "https://kachabiti.tn",
              logo: "https://kachabiti.tn/assets/images/logo.svg",
              description: "Premium handcrafted traditional products and authentic artisan goods",
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+216 55 558 648",
                contactType: "customer service",
                email: "Kachabity@gmail.com",
              },
              address: {
                "@type": "PostalAddress",
                addressCountry: "TN",
                addressLocality: "Tunisia",
              },
              sameAs: [
                "https://www.facebook.com/artisan-kraiem",
                "https://www.instagram.com/artisan-kraiem",
                "https://www.youtube.com/artisan-kraiem",
                "https://www.twitter.com/artisan-kraiem",
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.className} ${hando.variable}`} suppressHydrationWarning>
        <ConfigProvider>
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
        </ConfigProvider>
      </body>
    </html>
  );
}