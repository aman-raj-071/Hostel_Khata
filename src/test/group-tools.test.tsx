import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GroupTools } from "@/components/GroupTools";
import { VoiceContext } from "@/lib/voice-context";
import { DraftRecovery } from "@/components/DraftRecovery";
import { getDraft, setDraft } from "@/lib/draft";
import { storeCheckpoint, loadCheckpoint } from "@/lib/recovery";
import type { ParsedExpense } from "@/lib/types";
import { parseVoiceCommand } from "@/lib/voice";
const mocks = vi.hoisted(() => ({
  group: vi.fn(),
  balances: vi.fn(),
  settlements: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  getGroup: mocks.group,
  getBalances: mocks.balances,
  getSettlements: mocks.settlements,
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => mocks.navigate,
}));
const stop = vi.fn();
const speak = vi.fn();
const cancel = vi.fn();
let last: SpeechSynthesisUtterance;
const expense: ParsedExpense = {
  payer: "Kabir",
  amount: 100,
  description: "Dinner",
  category: "food",
  date: "2026-10-30",
  splitType: "equal",
  participants: ["Kabir"],
  shares: [{ member: "Kabir", amount: 100 }],
  confidence: 0.9,
  needsClarification: false,
  question: null,
};
it.each([
  ["kaun pay kare", "who should pay next"],
  ["who should pay next", "who should pay next"],
  ["hisaab sunao", "listen to group briefing"],
  ["read balances", "listen to group briefing"],
  ["restore review", "restore review"],
  ["review wapas lao", "restore review"],
])("routes the new voice command %s to the actual button", (phrase, target) => {
  expect(parseVoiceCommand(phrase)).toEqual({ kind: "click", target });
});
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setDraft([]);
  mocks.group.mockResolvedValue({
    id: "g",
    name: "Flat 302",
    members: [
      { id: "k", name: "Kabir" },
      { id: "a", name: "Aman" },
    ],
  });
  mocks.balances.mockResolvedValue([
    { memberId: "k", net: 100 },
    { memberId: "a", net: -100 },
  ]);
  mocks.settlements.mockResolvedValue([{ fromId: "a", toId: "k", amount: 100 }]);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
        last = this as unknown as SpeechSynthesisUtterance;
      }
    },
  );
  vi.stubGlobal("speechSynthesis", { speak, cancel });
});
afterEach(() => {
  cleanup();
  setDraft([]);
  vi.unstubAllGlobals();
});
function showTools() {
  return render(
    <VoiceContext.Provider
      value={{
        active: true,
        dictating: false,
        supported: true,
        transcript: "",
        startExpense: vi.fn(),
        stop,
      }}
    >
      <GroupTools />
    </VoiceContext.Provider>,
  );
}
it("loads fresh data, shows optional payer suggestion, never records payments", async () => {
  showTools();
  fireEvent.click(screen.getByRole("button", { name: "Who should pay next" }));
  expect(await screen.findByText(/Aman could pay next/)).toBeInTheDocument();
  expect(speak).not.toHaveBeenCalled();
  expect(mocks.balances).toHaveBeenCalledTimes(1);
});
it("stops recognition before speaking and cancels on close; never auto-resumes mic", async () => {
  showTools();
  fireEvent.click(screen.getByRole("button", { name: "Listen to group briefing" }));
  await waitFor(() => expect(speak).toHaveBeenCalledOnce());
  expect(stop).toHaveBeenCalledOnce();
  expect(stop.mock.invocationCallOrder[0]).toBeLessThan(speak.mock.invocationCallOrder[0]!);
  expect(last.text).toContain("Aman pays Kabir 100.00 rupees");
  fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!);
  expect(cancel).toHaveBeenCalled();
});
it("keeps readable fallback when audio is unsupported or errors", async () => {
  vi.stubGlobal("speechSynthesis", undefined);
  showTools();
  fireEvent.click(screen.getByRole("button", { name: "Listen to group briefing" }));
  expect(await screen.findByText(/Audio unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/Kabir gets back/)).toBeInTheDocument();
  cleanup();
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  showTools();
  fireEvent.click(screen.getByRole("button", { name: "Listen to group briefing" }));
  await waitFor(() => expect(speak).toHaveBeenCalled());
  act(() => last.onerror?.({} as SpeechSynthesisErrorEvent));
  expect(screen.getByText(/Audio could not play/)).toBeInTheDocument();
});
it("shows request failure and ignores responses after close", async () => {
  mocks.balances.mockRejectedValueOnce(new Error("Network unavailable"));
  showTools();
  fireEvent.click(screen.getByRole("button", { name: "Listen to group briefing" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  let resolve: (value: unknown) => void = () => {};
  mocks.balances.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await act(async () =>
    resolve([
      { memberId: "k", net: 100 },
      { memberId: "a", net: -100 },
    ]),
  );
  expect(speak).not.toHaveBeenCalled();
});
it("only restores checkpoint after explicit action and clears backup on discard", async () => {
  storeCheckpoint(localStorage, "g", [expense], "original input");
  render(<DraftRecovery groupId="g" />);
  expect(await screen.findByRole("button", { name: "Restore review" })).toBeInTheDocument();
  expect(getDraft()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Restore review" }));
  expect(getDraft()).toEqual([expense]);
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/review" });
  act(() => setDraft([]));
  expect(loadCheckpoint(localStorage, "g")).toBeNull();
});
