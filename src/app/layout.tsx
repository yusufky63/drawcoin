import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Playfair_Display, Crimson_Text, Poppins } from 'next/font/google';
import Providers from "./providers";
import ArtHeader from "../components/Header";
import Footer from "../components/Footer";

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const crimson = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-crimson',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://drawcoin.app"
  ),
  title: "DrawCoin",
  description: "Create and trade hand-drawn art tokens on Base.",
  keywords: ["Base", "tokens", "drawcoin", "web3", "art", "draw", "drawing", "trading"],
  authors: [{ name: "DrawCoin" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "DrawCoin",
    description: "Create and trade hand-drawn art tokens on Base.",
    type: "website",
    url: "https://drawcoin.app",
    images: [
      {
        url: "https://drawcoin.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "DrawCoin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DrawCoin",
    description: "Create and trade hand-drawn art tokens on the Base",
    images: ["https://drawcoin.app/opengraph-image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: "https://drawcoin.app/opengraph-image.png",
      button: {
        title: "Draw Token",
        action: {
          type: "launch_frame",
          name: "DrawCoin",
          url: "https://drawcoin.app",
          splashImageUrl: "https://drawcoin.app/logo.png",
          splashBackgroundColor: "#fff"
        }
      }
    })
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${crimson.variable} ${poppins.variable}`}>
      <head>
        {/* Farcaster manifest */}
        <link rel="farcaster-app-config" href="/.well-known/farcaster.json" />
        
        {/* Allow embedding from anywhere */}
        <meta httpEquiv="X-Frame-Options" content="ALLOWALL" />
        <meta httpEquiv="Content-Security-Policy" content="frame-ancestors *" />
      </head>
      <body>
        <Providers>
          <ArtHeader />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
