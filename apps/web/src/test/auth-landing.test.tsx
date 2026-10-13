import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { json, renderApp, stubApi } from "./utils";

// WebGL does not exist in jsdom; the 3D hero is lazy and decorative.
vi.mock("@/components/hero/hero-scene", () => ({ default: () => null }));

describe("landing", () => {
  it("shows the product pitch with calls to action, without a mocked claim of progress", async () => {
    stubApi();
    renderApp("/", { signedIn: false });
    expect(
      await screen.findByRole("heading", { name: /Become the person you were meant to become/i }),
    ).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Build My Alter Ego/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Seven layers, one coherent person/i)).toBeTruthy();
    expect(screen.getByText(/15 to 25 minute interview/i)).toBeTruthy();
    expect(screen.queryByText(/generated instantly/i)).toBeNull();
    expect(screen.queryByText(/Sovereignty trait sits at 46/i)).toBeNull();
  });

  it("sends signed-in users straight to the dashboard", async () => {
    stubApi({ "GET /api/v1/dashboard": () => json({ detail: "none" }, 404) });
    renderApp("/");
    expect(await screen.findByText(/Begin the interview/i)).toBeTruthy();
  });

  it("shows a not-found page for unknown routes", async () => {
    stubApi();
    renderApp("/nope", { signedIn: false });
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });
});

describe("auth", () => {
  it("protects pages and redirects signed-out users to /auth", async () => {
    stubApi();
    renderApp("/dashboard", { signedIn: false });
    expect(await screen.findByText(/Sovereignty awaits/i)).toBeTruthy();
  });

  it("signs in and routes a returning user to the dashboard", async () => {
    const { calls } = stubApi({
      "POST /api/v1/auth/token": () => json({ access: "a", refresh: "r" }),
      "GET /api/v1/protocols/latest": () => json({ id: "p", status: "ready" }),
      "GET /api/v1/dashboard": () => json({ detail: "none" }, 404),
    });
    renderApp("/auth", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /Access OS/i }));
    await waitFor(() => expect(calls).toContain("POST /api/v1/auth/token"));
    await waitFor(() => expect(calls).toContain("GET /api/v1/dashboard"));
  });

  it("sends a brand-new user to the interview after sign in", async () => {
    const { calls } = stubApi({
      "POST /api/v1/auth/token": () => json({ access: "a", refresh: "r" }),
      "GET /api/v1/protocols/latest": () => json({ detail: "none" }, 404),
      "POST /api/v1/interviews": () => json({ detail: "x" }, 500),
    });
    renderApp("/auth", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "n@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /Access OS/i }));
    await waitFor(() => expect(calls).toContain("POST /api/v1/interviews"));
    expect(calls).not.toContain("GET /api/v1/dashboard");
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not start the interview/i);
  });

  it("shows a clear error for wrong credentials", async () => {
    stubApi({ "POST /api/v1/auth/token": () => json({ detail: "no" }, 401) });
    renderApp("/auth", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /Access OS/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/incorrect/i);
  });

  it("requires accepting terms before creating an account", async () => {
    const { calls } = stubApi();
    renderApp("/auth?mode=signup", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Full Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-enough-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin onboarding/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/consent/i);
    expect(calls).not.toContain("POST /api/v1/auth/register");
  });

  it("registers with consent and starts the interview", async () => {
    const { bodies } = stubApi({
      "POST /api/v1/auth/register": () =>
        json({ user: { id: "u" }, access: "a", refresh: "r" }, 201),
      "POST /api/v1/interviews": () => json({ detail: "x" }, 500),
    });
    renderApp("/auth?mode=signup", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Full Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-enough-passphrase" } });
    fireEvent.click(screen.getByLabelText(/accept the terms/i));
    fireEvent.click(screen.getByRole("button", { name: /Begin onboarding/i }));
    await waitFor(() => expect(bodies["POST /api/v1/auth/register"]).toBeTruthy());
    const sent = bodies["POST /api/v1/auth/register"]![0] as {
      consents: Array<{ purpose: string; granted: boolean }>;
    };
    expect(sent.consents.filter((c) => c.granted).map((c) => c.purpose).sort()).toEqual([
      "privacy",
      "terms",
    ]);
  });
});
