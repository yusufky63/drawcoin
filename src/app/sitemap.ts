import type { MetadataRoute } from "next";

const SITE_URL = "https://drawcoin.app";

const publicRoutes = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/create", changeFrequency: "monthly", priority: 0.9 },
  { path: "/missions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.7 },
  { path: "/most-watchlisted", changeFrequency: "daily", priority: 0.7 },
  { path: "/stats", changeFrequency: "daily", priority: 0.6 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.5 },
  { path: "/live-canvas", changeFrequency: "weekly", priority: 0.5 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
