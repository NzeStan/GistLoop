import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAuthForTests } from "@/api/auth";
import { AppProviders, createQueryClient } from "@/app/providers";

import { LoginPage } from "./AuthPages";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const tokens = {
  token_type: "Bearer",
  access: "access-1",
  access_expires_at: new Date(Date.now() + 300_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  session_id: "s1",
};

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/feed", element: <h1>Your feed</h1> },
    ],
    { initialEntries: ["/login"] },
  );
  render(
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe("sign in", () => {
  beforeEach(() => __resetAuthForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("validates before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email or username")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains wrong credentials without saying which part was wrong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: { code: "invalid_credentials", message: "x" } }, 401)),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email or username"), "ada");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/That email or password isn't right/)).toBeInTheDocument();
  });

  it("asks for the code when two-step verification is on, then signs in", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/bff/auth/login/")) {
        return json({ mfa_required: true, challenge_id: "c1", channel: "email", destination: "a***@example.com" }, 202);
      }
      if (url.endsWith("/bff/auth/login/mfa/")) return json(tokens);
      return json({ id: "u1", email: "ada@example.com", display_name: "Ada", handle: "ada" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = renderLogin();
    await userEvent.type(screen.getByLabelText("Email or username"), "ada");
    await userEvent.type(screen.getByLabelText("Password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/a\*\*\*@example.com/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Verification code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/feed"));
    const mfaBody = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).endsWith("/mfa/"))![1].body);
    expect(mfaBody).toMatchObject({ challenge_id: "c1", code: "123456" });
  });
});
