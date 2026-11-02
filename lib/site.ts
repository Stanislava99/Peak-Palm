export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function isPreviewDeployment() {
  return process.env.VERCEL_ENV === "preview" || process.env.APP_ENV?.trim().toLowerCase() === "test";
}
