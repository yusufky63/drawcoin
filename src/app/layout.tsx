import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Playfair_Display, Crimson_Text } from 'next/font/google';
import Providers from "./providers";
import ArtHeader from "../components/Header";

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL || "https://drawcoin-mini.vercel.app"
  ),
  title: "DrawCoin",
  description: "Create and trade hand-drawn art tokens on Base.",
  keywords: ["Base", "tokens", "drawcoin", "web3", "art", "draw", "drawing", "trading"],
  authors: [{ name: "DrawCoin Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "DrawCoin",
    description: "Create and trade hand-drawn art tokens on Base.",
    type: "website",
    url: "https://drawcoin-mini.vercel.app",
    images: [
      {
        url: "https://drawcoin-mini.vercel.app/opengraph-image.png",
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
    images: ["https://drawcoin-mini.vercel.app/opengraph-image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: "https://drawcoin-mini.vercel.app/opengraph-image.png",
      button: {
        title: "Draw Coin",
        action: {
          type: "launch_miniapp",
          name: "DrawCoin",
          url: "https://drawcoin-mini.vercel.app",
          splashImageUrl: "https://drawcoin-mini.vercel.app/splash.png",
          splashBackgroundColor: "#3182ce"
        }
      }
    })
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3182ce",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${crimson.variable}`}>
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
        </Providers>
      </body>
    </html>
  );
}
