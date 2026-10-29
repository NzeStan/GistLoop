import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { RichText } from "./RichText";

const renderText = (text: string) =>
  render(
    <MemoryRouter>
      <RichText text={text} />
    </MemoryRouter>,
  );

describe("RichText", () => {
  it("links hashtags, mentions and URLs", () => {
    renderText("Join #Hackathon with @tunde at https://example.com/register");
    expect(screen.getByRole("link", { name: "#Hackathon" })).toHaveAttribute("href", "/tags/hackathon");
    expect(screen.getByRole("link", { name: "@tunde" })).toHaveAttribute("href", "/u/tunde");
    const external = screen.getByRole("link", { name: /example\.com/ });
    expect(external).toHaveAttribute("href", "https://example.com/register");
    expect(external).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders markup as plain text", () => {
    const { container } = renderText('<img src=x onerror="alert(1)"><script>alert(1)</script>');
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });
});
