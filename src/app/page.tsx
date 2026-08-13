import HomeHero from "@/components/home/HomeHero";
import MarketPage from "@/components/market/MarketPage";

export default function Home() {
  return (
    <div className="min-h-screen bg-art-gray-50 pb-8 lg:pb-10">
      <HomeHero />
      <div id="collection" className="scroll-mt-28">
        <MarketPage />
      </div>
    </div>
  );
}
