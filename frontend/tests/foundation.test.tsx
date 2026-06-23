import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/ui/button";
import { router } from "@/router";

describe("P1 foundation", () => {
  it("renders a themed button", () => {
    render(<Button variant="primary">Run</Button>);
    const button = screen.getByRole("button", { name: "Run" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("bg-primary");
  });

  it("builds the router with home, graph and editor routes", () => {
    const shell = router.routes.find((r) => r.path === "/");
    const paths = shell?.children?.map((r) => r.path ?? "index") ?? [];
    expect(paths).toContain("project/:projectId/graph");
    expect(paths).toContain("project/:projectId/editor");
  });
});
