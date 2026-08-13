import type { Metadata } from "next";

import MissionsPage from "@/components/missions/MissionsPage";

export const metadata: Metadata = {
  title: "Draw Missions | DrawCoin",
  description: "Complete verified DrawCoin missions and claim badges on Base.",
};

export default function Page() {
  return <MissionsPage />;
}
