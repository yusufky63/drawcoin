function withValidProperties(
  properties: Record<string, undefined | string | string[]>
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) =>
      Array.isArray(value) ? value.length > 0 : !!value
    )
  );
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL as string;

  const manifest = {
    accountAssociation: {
      header:
        "eyJmaWQiOjg2NDc5MywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweENjZTJFMjI5NzNmMUY1MTA5MjQzQTZiNkREZTdBNDk4QzlENjYzNjYifQ",
      payload: "eyJkb21haW4iOiJkcmF3Y29pbi1taW5pLnZlcmNlbC5hcHAifQ",
      signature:
        "MHg1MjY1ZjkyMmFkNTcxNWUwODc1MTdkM2VlNGEwMTE1YjMxNGNiYTZkNGVkOWFmZTM3ZDgyYWZlY2QxYjQ3YjdjNjljMDQ1NjFhOTg5ZmE3ZmE5Y2VhODU5NmJjMjU1YjA1YTVkMDM2ZjBkMTQ5NTcyMzNiNzE3ZjI3ODYwYmFiMzFi",
    },
    baseBuilder: {
      allowedAddresses: ["0xc0F52851fCAac0cac016432E5e11954632cd2fcB"],
    },
    miniapp: {
      version: "1",
      name: "DrawCoin",
      description: "Create and trade hand-drawn art tokens on Base.",
      iconUrl: "https://drawcoin-mini.vercel.app/logo.png",
      homeUrl: "https://drawcoin-mini.vercel.app",
      webhookUrl: "https://drawcoin-mini.vercel.app/api/webhook",
      imageUrl: "https://drawcoin-mini.vercel.app/opengraph-image.png",
      screenshotUrls: [
        "https://drawcoin-mini.vercel.app/images/screenshot1.png",
      ],
      tags: ["nft", "tokens", "web3", "draw", "art"],
      primaryCategory: "art-creativity",
      buttonTitle: "Create Token",
      splashImageUrl: "https://drawcoin-mini.vercel.app/logo.png",
      splashBackgroundColor: "#fff",
      subtitle: "Hand-drawn art tokens on Base",
      heroImageUrl: "https://drawcoin-mini.vercel.app/opengraph-image.png",
      tagline: "Create and trade draw tokens",
      ogTitle: "DrawCoin",
      ogDescription: "Create and trade hand-drawn art tokens on the Base",
      ogImageUrl: "https://drawcoin-mini.vercel.app/opengraph-image.png",
      noindex: false,
    },
  };

  return Response.json(manifest);
}
