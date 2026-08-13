import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Playfair_Display, Crimson_Text, Poppins } from "next/font/google";
import Providers from "./providers";
import ArtHeader from "../components/Header";
import Footer from "../components/Footer";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const crimson = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://drawcoin.app"),
  applicationName: "DrawCoin",
  title: {
    default: "DrawCoin - Draw, launch and collect on Base",
    template: "%s | DrawCoin",
  },
  description:
    "Draw original artwork, launch it as an onchain collectible through Zora, and discover creators on Base.",
  keywords: [
    "Base",
    "tokens",
    "drawcoin",
    "web3",
    "art",
    "draw",
    "drawing",
    "trading",
  ],
  authors: [{ name: "DrawCoin" }],
  creator: "DrawCoin",
  category: "art",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", sizes: "1024x1024", type: "image/png" }],
  },
  openGraph: {
    title: "DrawCoin - Draw, launch and collect on Base",
    description:
      "Draw original artwork, launch it through Zora, and discover creators on Base.",
    type: "website",
    url: "https://drawcoin.app",
    siteName: "DrawCoin",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DrawCoin - Draw, launch and collect on Base",
    description:
      "Draw original artwork, launch it through Zora, and discover creators on Base.",
  },
  other: {
    "base:app_id": "68ed631a346a76766395203c",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0052ff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${crimson.variable} ${poppins.variable}`}
    >
      <body>
        <Providers>
          <ArtHeader />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
