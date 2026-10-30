import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContext, useState } from "react";
import { VoiceContext } from "@/lib/voice-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceControl } from "@/components/VoiceControl";
import type { Recognition, RecognitionResult } from "@/hooks/use-speech-recognition";
import {
  activateVoiceTarget,
  findVoiceTarget,
  getVoiceInput,
  getVoiceTargets,
  parseVoiceCommand,
  scrollVoicePage,
  writeVoiceInput,
} from "@/lib/voice";

const navigate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: "/" }),
}));

class MockRecognition implements Recognition {
  static instances: MockRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: Recognition["onstart"] = null;
  onresult: Recognition["onresult"] = null;
  onerror: Recognition["onerror"] = null;
  onend: Recognition["onend"] = null;
  results: RecognitionResult[] = [];
  start = vi.fn(() => {
    this.results = [];
    this.onstart?.();
  });
  abort = vi.fn();
  constructor() {
    MockRecognition.instances.push(this);
  }
  say(text: string) {
    this.results.push({ isFinal: true, 0: { transcript: text } });
    this.onresult?.({ resultIndex: this.results.length - 1, results: this.results });
  }
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
  MockRecognition.instances = [];
  navigate.mockClear();
  vi.stubGlobal("SpeechRecognition", MockRecognition);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  if (originalScrollIntoView)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Hindi, Hinglish and English voice commands", () => {
  it.each([
    ["balances kholo", { kind: "navigate", to: "/balances" }],
    ["बैलेंस दिखाओ", { kind: "navigate", to: "/balances" }],
    ["open history", { kind: "navigate", to: "/history" }],
    ["report kholo", { kind: "navigate", to: "/report" }],
    ["members kholo", { kind: "navigate", to: "/members" }],
    ["review kholo", { kind: "navigate", to: "/review" }],
    ["settle kholo", { kind: "navigate", to: "/settle" }],
    ["add kholo", { kind: "navigate", to: "/" }],
    ["click five", { kind: "click", target: "5" }],
    ["बटन १२", { kind: "click", target: "12" }],
    ["बटन पांच", { kind: "click", target: "5" }],
    ["parse karo", { kind: "click", target: "parse" }],
    ["save karo", { kind: "click", target: "save" }],
    ["likho Kabir ne dinner 500 kiya", { kind: "write", text: "Kabir ne dinner 500 kiya" }],
    ["search chai", { kind: "search", text: "chai" }],
    ["likhna shuru", { kind: "dictate" }],
    ["लिखना बंद", { kind: "end-dictation" }],
    ["mic band", { kind: "stop" }],
    ["delete everything now", { kind: "unknown" }],
  ])("understands %s", (text, expected) => {
    expect(parseVoiceCommand(text as string)).toEqual(expected);
  });
});

describe("voice targets reuse existing controls", () => {
  it("numbers only visible page controls, ignoring the voice toolbar and hidden background", () => {
    document.body.innerHTML =
      '<div data-voice-ui><button>Mic</button></div><div aria-hidden="true"><button>Background</button></div><button hidden>Hidden</button><button>Save all</button><button>Save changes</button>';
    const targets = getVoiceTargets();
    expect(targets.map((t) => t.label)).toEqual(["Save all", "Save changes"]);
    expect(findVoiceTarget(targets, "2").label).toBe("Save changes");
    expect(() => findVoiceTarget(targets, "save")).toThrow(/Ek se zyada/);
    expect(() => findVoiceTarget(targets, "99")).toThrow(/number/);
  });
  it("does not click disabled, hidden or stale controls", () => {
    const button = document.createElement("button");
    button.disabled = true;
    document.body.append(button);
    const clicked = vi.fn();
    button.onclick = clicked;
    expect(() => activateVoiceTarget({ element: button, label: "Save" })).toThrow(/ready/);
    button.disabled = false;
    button.remove();
    expect(() => activateVoiceTarget({ element: button, label: "Save" })).toThrow(/badal/);
    expect(clicked).not.toHaveBeenCalled();
  });
  it("scrolls an open sheet instead of the page behind it", () => {
    document.body.innerHTML = '<div role="dialog" style="overflow-y:auto"></div>';
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    Object.defineProperties(dialog, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 200 },
    });
    dialog.scrollBy = vi.fn();
    scrollVoicePage("down");
    expect(dialog.scrollBy).toHaveBeenCalledWith({ top: 130, behavior: "smooth" });
  });
  it("updates controlled React inputs, while invalid amounts leave values intact", () => {
    function Form() {
      const [value, setValue] = useState("10");
      return (
        <>
          <input
            aria-label="Amount"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <output>{value}</output>
        </>
      );
    }
    render(<Form />);
    const field = screen.getByLabelText("Amount") as HTMLInputElement;
    act(() => {
      writeVoiceInput(field, "१२.५०");
    });
    expect(screen.getByRole("status")).toHaveTextContent("12.50");
    expect(() => writeVoiceInput(field, "lots of money")).toThrow(/Amount/);
    expect(field.value).toBe("12.50");
  });
  it("handles UPI, dates, dropdown choices and a focused field", () => {
    document.body.innerHTML =
      '<input aria-label="Aman UPI ID"><input type="date" aria-label="Date"><select aria-label="Month"><option value="2026-10">October 2026</option><option value="2026-09">September 2026</option></select>';
    const [upi, date, select] = [
      ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select"),
    ];
    writeVoiceInput(upi!, "aman dot raj at ybl");
    expect(upi!.value).toBe("aman.raj@ybl");
    writeVoiceInput(date!, "2026 dash 10 dash 29");
    expect(date!.value).toBe("2026-10-29");
    expect(() => writeVoiceInput(date!, "2026-02-30")).toThrow(/Date/);
    writeVoiceInput(select!, "September 2026");
    expect(select!.value).toBe("2026-09");
    upi!.focus();
    expect(getVoiceInput(getVoiceTargets())).toBe(upi);
    const combo = document.createElement("button");
    combo.setAttribute("role", "combobox");
    document.body.append(combo);
    const key = vi.fn();
    combo.onkeydown = key;
    activateVoiceTarget({ element: combo, label: "Payer" });
    expect(key).toHaveBeenCalled();
  });
});

describe("speech recognition and hands-free operation", () => {
  it("recognizes Wrapped, reminder and natural confirmation commands", () => {
    expect(parseVoiceCommand("wrapped dikhao")).toEqual({ kind: "navigate", to: "/wrapped" });
    expect(parseVoiceCommand("settle up kholo")).toEqual({ kind: "navigate", to: "/settle" });
    expect(parseVoiceCommand("reminder bhejo")).toEqual({ kind: "click", target: "send reminder" });
    expect(parseVoiceCommand("haan theek hai")).toEqual({ kind: "confirm" });
  });
  it("confirms the visible review save but cannot bypass a disabled confirmation", () => {
    const save = vi.fn();
    const view = render(
      <>
        <VoiceControl />
        <button onClick={save} disabled>
          Save all
        </button>
      </>,
    );
    const mic = start();
    act(() => mic.say("haan theek hai"));
    expect(save).not.toHaveBeenCalled();
    view.rerender(
      <>
        <VoiceControl />
        <button onClick={save}>Save all</button>
      </>,
    );
    act(() => mic.say("haan theek hai"));
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("starts hero dictation in the same recognition session and preserves explicit parse", () => {
    const parse = vi.fn();
    function Hero() {
      const voice = useContext(VoiceContext);
      const [value, setValue] = useState("");
      return (
        <>
          <button onClick={() => voice?.startExpense()}>Hero mic</button>
          <textarea
            aria-label="Expense text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button onClick={parse}>Parse</button>
        </>
      );
    }
    render(
      <VoiceControl>
        <Hero />
      </VoiceControl>,
    );
    fireEvent.click(screen.getByText("Hero mic"));
    expect(MockRecognition.instances).toHaveLength(1);
    const mic = MockRecognition.instances[0]!;
    act(() => mic.say("Dinner 600 sabke liye"));
    expect(screen.getByLabelText("Expense text")).toHaveValue("Dinner 600 sabke liye");
    expect(parse).not.toHaveBeenCalled();
    act(() => mic.say("likhna band"));
    act(() => mic.say("parse karo"));
    expect(parse).toHaveBeenCalledTimes(1);
  });
  function start() {
    fireEvent.click(screen.getByRole("button", { name: "Start voice" }));
    return MockRecognition.instances[0]!;
  }
  it("does not access the microphone until Start, navigates, and ignores interim or duplicate results", () => {
    render(<VoiceControl />);
    expect(MockRecognition.instances).toHaveLength(0);
    const mic = start();
    expect(mic.lang).toBe("en-IN");
    expect(mic.continuous).toBe(true);
    act(() => {
      mic.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "save karo" } }],
      });
    });
    expect(navigate).not.toHaveBeenCalled();
    act(() => mic.say("बैलेंस दिखाओ"));
    expect(navigate).toHaveBeenCalledWith({ to: "/balances" });
    act(() => {
      mic.onresult?.({ resultIndex: 0, results: mic.results });
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    act(() => mic.say("mic band"));
    expect(mic.abort).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start voice" })).toBeInTheDocument();
  });
  it("dictates without triggering commands, then parses only after dictation ends", () => {
    const parse = vi.fn();
    function Add() {
      const [value, setValue] = useState("");
      return (
        <>
          <VoiceControl />
          <textarea
            aria-label="Expense text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button onClick={parse}>Parse</button>
        </>
      );
    }
    render(<Add />);
    const mic = start();
    act(() => mic.say("likhna shuru"));
    act(() => mic.say("Kabir ne dinner 500 kiya"));
    act(() => mic.say("save karo"));
    expect(screen.getByLabelText("Expense text")).toHaveValue("Kabir ne dinner 500 kiya save karo");
    expect(parse).not.toHaveBeenCalled();
    act(() => mic.say("likhna band"));
    act(() => mic.say("parse karo"));
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("operates the real dropdown using spoken labels", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    function Page() {
      const [payer, setPayer] = useState("Kabir");
      return (
        <>
          <VoiceControl />
          <Select value={payer} onValueChange={setPayer}>
            <SelectTrigger aria-label="Paid by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Kabir">Kabir</SelectItem>
              <SelectItem value="Riya">Riya</SelectItem>
            </SelectContent>
          </Select>
          <output data-testid="payer">{payer}</output>
        </>
      );
    }
    render(<Page />);
    const mic = start();
    act(() => mic.say("click Paid by"));
    await screen.findByRole("option", { name: "Riya" });
    act(() => mic.say("click Riya"));
    await waitFor(() => expect(screen.getByTestId("payer")).toHaveTextContent("Riya"));
  });
  it("opens the existing delete confirmation and needs a separate confirm command", () => {
    const deleted = vi.fn();
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <VoiceControl />
          <button onClick={() => setOpen(true)}>Delete dinner</button>
          {open && (
            <div role="alertdialog">
              <button onClick={deleted}>Delete</button>
              <button onClick={() => setOpen(false)}>Cancel</button>
            </div>
          )}
        </>
      );
    }
    render(<Page />);
    const mic = start();
    act(() => mic.say("click Delete dinner"));
    expect(deleted).not.toHaveBeenCalled();
    act(() => mic.say("confirm"));
    expect(deleted).toHaveBeenCalledTimes(1);
  });
  it("stops on permission/network failures without retry loops", () => {
    vi.useFakeTimers();
    render(<VoiceControl />);
    const mic = start();
    act(() => mic.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("status")).toHaveTextContent("Mic permission nahi mili");
    act(() => {
      mic.onend?.();
      vi.advanceTimersByTime(1000);
    });
    expect(mic.start).toHaveBeenCalledTimes(1);
  });
  it("restarts after silence but releases the microphone when the tab hides or component unmounts", () => {
    vi.useFakeTimers();
    const view = render(<VoiceControl />);
    const mic = start();
    act(() => {
      mic.onend?.();
      vi.advanceTimersByTime(400);
    });
    expect(mic.start).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mic.abort).toHaveBeenCalled();
    act(() => {
      mic.onend?.();
      vi.advanceTimersByTime(1000);
    });
    expect(mic.start).toHaveBeenCalledTimes(2);
    view.unmount();
  });
  it("shows an unsupported-browser message instead of crashing", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    render(<VoiceControl />);
    expect(screen.queryByRole("button", { name: "Start voice" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("available nahi hai");
  });
});
