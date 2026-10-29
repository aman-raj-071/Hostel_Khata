import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memberIdentity } from "@/lib/member-identity";
import { Avatar, EmptyState } from "@/components/States";
import { Money } from "@/components/Money";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("member identity", () => {
  it("keeps the same color across casing and spacing, and supports initials", () => {
    expect(memberIdentity(" Kabir ").color).toBe(memberIdentity("kabir").color);
    expect(memberIdentity("Riya Sharma").initials).toBe("RS");
    expect(memberIdentity("").initials).toBe("?");
    render(<Avatar name="Riya Sharma" />);
    expect(screen.getByLabelText("Riya Sharma")).toHaveTextContent("RS");
  });
});

describe("settled celebration and money", () => {
  it("only celebrates when explicitly settled", () => {
    const view = render(<EmptyState emoji="👋" title="No members" />);
    expect(view.container.querySelector(".confetti")).toBeNull();
    view.rerender(<EmptyState emoji="🎉" title="All settled" celebrate />);
    expect(screen.getByLabelText("Happy khata book")).toBeInTheDocument();
    expect(view.container.querySelectorAll(".confetti i")).toHaveLength(24);
  });
  it("does not animate money when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const frame = vi.spyOn(window, "requestAnimationFrame");
    render(<Money amount={799.01} />);
    expect(screen.getByLabelText(/799\.01/)).toHaveTextContent(/799\.01/);
    expect(frame).not.toHaveBeenCalled();
  });
  it("cancels a pending animation on unmount", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const view = render(<Money amount={600} />);
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
