type FarcasterShare = {
  text: string;
  embed?: string;
  channelKey?: string;
};

// Base App runs DrawCoin as a standard web app, so optional Farcaster sharing
// uses the public intent URL instead of relying on a Mini App SDK context.
export function openFarcasterComposer({
  text,
  embed,
  channelKey,
}: FarcasterShare): void {
  const composer = new URL("https://farcaster.xyz/~/compose");
  composer.searchParams.set("text", text);
  if (embed) composer.searchParams.append("embeds[]", embed);
  if (channelKey) composer.searchParams.set("channelKey", channelKey);

  window.open(composer.toString(), "_blank", "noopener,noreferrer");
}
