import type { Metadata } from "next";

import MarketsPage from "@/components/market/MarketsPage";

export const metadata: Metadata = {
  title: "Markets",
  description: "Browse DrawCoin markets ordered by new launches or market cap.",
};

export default function Page() {
  return <MarketsPage />;
}
