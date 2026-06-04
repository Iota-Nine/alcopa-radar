/** Serveur Vercel (serverless). */
export function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

/** Scan massif + OCR CT : prévu pour un serveur long (local, VPS). */
export function isServerlessHost(): boolean {
  return isVercel();
}

/** Durée max réaliste des fonctions (Hobby ≈ 10 s, Pro jusqu’à 60+ si vercel.json). */
export function serverlessBudgetMs(): number {
  if (!isVercel()) return 240_000;
  const plan = process.env.VERCEL_ENV;
  if (plan === "production" || plan === "preview") {
    return 9_000;
  }
  return 9_000;
}

export function analyzeBatchSize(): number {
  return isVercel() ? 3 : 18;
}

export function analyzeConcurrency(): number {
  return isVercel() ? 2 : 6;
}

export function skipCtOnServer(): boolean {
  return isVercel();
}
