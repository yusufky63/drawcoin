function withValidProperties(properties: Record<string, undefined | string | string[]>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
  );
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL as string;
  
  const manifest = {
    accountAssociation: {
      header: "eyJmaWQiOjg2NDc5MywidHlwZSI6ImF1dGgiLCJrZXkiOiIweDYwNzE4NGVkMTA3NDA5QjU5MTg0QTVEQUYzNDJmMDAzNDNCNWNjMDQifQ",
      payload: "eyJkb21haW4iOiJkcmF3Y29pbi52ZXJjZWwuYXBwIn0",
      signature: "aRsAAmVQo17SubvqWgnIHW0vlDze4eWuOCaVKSvA6rFmtQ/eMAfiVHdZmZMS5eWQCFwzN161b6FGM0HFWAFx4hw="
    },
    baseBuilder: {
      allowedAddresses: ["0xc0F52851fCAac0cac016432E5e11954632cd2fcB"]
    },
    miniapp: {
      version: "1",
      name: "DrawCoin",
      description: "Create and trade hand-drawn art tokens on Base.",
      iconUrl: "https://drawcoin.vercel.app/logo.png",
      homeUrl: "https://drawcoin.vercel.app",
      imageUrl: "https://drawcoin.vercel.app/opengraph-image.png",
      screenshotUrls: ["https://drawcoin.vercel.app/images/screenshot1.png"],
      tags: ["nft", "tokens", "draw", "web3", "art"],
      primaryCategory: "art-creativity",
      buttonTitle: "Create Token",
      splashImageUrl: "https://drawcoin.vercel.app/logo.png",
      splashBackgroundColor: "#3182ce",
      subtitle: "Hand-drawn art tokens on Base",
      heroImageUrl: "https://drawcoin.vercel.app/opengraph-image.png",
      tagline: "Create and trade art tokens instantly",
      ogTitle: "DrawCoin",
      ogDescription: "Create and trade hand-drawn art tokens on the Base",
      ogImageUrl: "https://drawcoin.vercel.app/opengraph-image.png",
      noindex: false
    }
  };

  return Response.json(manifest);
}
