import { z } from "zod";

/** Mirrors accounts.models.ConsentPurpose on the API. */
export const consentPurpose = z.enum(["terms", "privacy", "ai_processing", "analytics", "marketing"]);
export type ConsentPurpose = z.infer<typeof consentPurpose>;

export const consentInput = z.object({
  purpose: consentPurpose,
  version: z.string().min(1).max(32),
  granted: z.boolean(),
});

/** Client-side form validation. The API remains the authority (password validators, uniqueness). */
export const registerInput = z.object({
  email: z.string().email(),
  password: z.string().min(10, "Use at least 10 characters"),
  display_name: z.string().max(120).optional(),
  timezone: z.string().max(64).optional(),
  consents: z
    .array(consentInput)
    .refine(
      (c) => ["terms", "privacy"].every((p) => c.some((x) => x.purpose === p && x.granted)),
      "Terms and privacy consent are required",
    ),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInput>;

/** Feature keys the API returns in `entitlements`. Mirrors billing.features.FEATURES. */
export const featureKey = z.enum([
  "protocol",
  "daily_os",
  "character",
  "knowledge",
  "mentor",
  "presence",
  "legacy",
  "calendar",
]);
export type FeatureKey = z.infer<typeof featureKey>;
