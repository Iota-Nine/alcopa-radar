import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Racine du projet (évite que Next prenne C:\Users\33651 à cause d’un autre package-lock.json). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["pdf-parse", "cheerio", "tesseract.js", "@napi-rs/canvas"],
};

export default nextConfig;
