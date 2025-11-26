import React from "react";
import { Coin } from "../../../lib/supabase";

interface CoinHeaderProps {
  token: Coin;
}

export const CoinHeader: React.FC<CoinHeaderProps> = () => {
  return null; // Token name now shown in CoinSummaryCard
};
