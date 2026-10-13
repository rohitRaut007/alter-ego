import { describe, expect, it } from "vitest";

import { loginInput, registerInput } from "./index";

const consents = [
  { purpose: "terms", version: "1", granted: true },
  { purpose: "privacy", version: "1", granted: true },
] as const;

describe("registerInput", () => {
  it("accepts a valid payload", () => {
    const res = registerInput.safeParse({
      email: "ada@example.com",
      password: "a-long-enough-passphrase",
      consents,
    });
    expect(res.success).toBe(true);
  });

  it("requires terms and privacy to be granted", () => {
    const res = registerInput.safeParse({
      email: "ada@example.com",
      password: "a-long-enough-passphrase",
      consents: [{ purpose: "terms", version: "1", granted: true }],
    });
    expect(res.success).toBe(false);
  });

  it("rejects short passwords", () => {
    const res = registerInput.safeParse({
      email: "ada@example.com",
      password: "short",
      consents,
    });
    expect(res.success).toBe(false);
  });
});

describe("loginInput", () => {
  it("rejects invalid email", () => {
    expect(loginInput.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});
