const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!raw) {
  throw new Error("VITE_API_BASE_URL is not set. Copy .env.example to apps/web/.env.");
}

export const API_BASE_URL: string = raw.replace(/\/$/, "");
