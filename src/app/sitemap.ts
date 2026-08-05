import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://stocks.mikesego.com";
  return ["", "/how-it-works", "/educators", "/privacy", "/terms", "/accessibility", "/status"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path ? "monthly" : "weekly", priority: path ? .7 : 1 }));
}
