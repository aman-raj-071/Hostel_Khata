import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReminder } from "./reminder.js";
import type { ReminderInput } from "../../src/lib/types.js";
import { REMINDER_SYSTEM_PROMPT } from "../prompts/reminderPrompt.js";

const { create, construct } = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    constructor() {
      construct();
    }
    messages = { create };
  },
}));
const members = [
  { id: "a", name: "Aman" },
  { id: "r", name: "Riya", upiId: "riya@ybl" },
];
const input: ReminderInput = { fromId: "a", toId: "r", amount: 340.51, tone: "polite" };
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("reminder generation", () => {
  it.each(["polite", "filmy", "mummy", "savage"] as const)(
    "returns two deterministic %s variants without constructing Claude",
    async (tone) => {
      vi.stubEnv("USE_CLAUDE_STUB", "true");
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key-never-used");
      const a = await generateReminder({ ...input, tone }, members);
      expect(await generateReminder({ ...input, tone }, members)).toEqual(a);
      const b = await generateReminder({ ...input, tone, amount: 340.5 }, members);
      expect(a.message.split("\n")[0]).not.toBe(b.message.split("\n")[0]);
      for (const name of ["Aman", "Riya", "₹340.51", "UPI"]) expect(a.message).toContain(name);
      expect(a.message.split("\n").length).toBeLessThanOrEqual(3);
      expect(construct).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );
  it("asks for a UPI ID when the creditor has not added one", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "true");
    expect(
      (
        await generateReminder(
          input,
          members.map((member) => ({ id: member.id, name: member.name })),
        )
      ).message,
    ).toContain("UPI ID share");
  });
  it("rejects invalid precision, tone, self-reminders and unknown members before calling Claude", async () => {
    await expect(generateReminder({ ...input, amount: 0.001 }, members)).rejects.toThrow();
    await expect(generateReminder({ ...input, amount: 0 }, members)).rejects.toThrow();
    await expect(generateReminder({ ...input, fromId: "r" }, members)).rejects.toThrow();
    await expect(
      generateReminder({ ...input, tone: "abusive" as ReminderInput["tone"] }, members),
    ).rejects.toThrow();
    await expect(generateReminder({ ...input, fromId: "outsider" }, members)).rejects.toThrow(
      "only members",
    );
    expect(construct).not.toHaveBeenCalled();
  });
  it("returns clear missing credential errors with the stub off", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(generateReminder(input, members)).rejects.toThrow(
      "ANTHROPIC_API_KEY not configured",
    );
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    await expect(generateReminder(input, members)).rejects.toThrow(
      "ANTHROPIC_MODEL not configured",
    );
  });
  it("uses the configured server model and prompt, validating real-path text", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "configured-model");
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Aman, Riya ko ₹340.51 bhej do. UPI available hai." }],
    });
    const result = await generateReminder(input, members);
    expect(result.message).toContain("₹340.51");
    expect(create.mock.calls[0]![0]).toMatchObject({
      model: "configured-model",
      system: REMINDER_SYSTEM_PROMPT,
      temperature: 0.2,
    });
    expect(JSON.parse(create.mock.calls[0]![0].messages[0].content)).toEqual({
      debtor: "Aman",
      creditor: "Riya",
      amount: "₹340.51",
      tone: "polite",
      upiAvailable: true,
    });
  });
  it.each([
    { stop_reason: "max_tokens", content: [] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Just pay someone" }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Aman\nRiya\n₹340.51\nUPI" }] },
  ])("rejects incomplete or invalid model output", async (response) => {
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "configured-model");
    create.mockResolvedValue(response);
    await expect(generateReminder(input, members)).rejects.toMatchObject({ status: 502 });
  });
  it("returns a friendly upstream failure without leaking details", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "configured-model");
    create.mockRejectedValue(new Error("private-provider-diagnostic"));
    await expect(generateReminder(input, members)).rejects.toThrow(
      "Couldn't generate the reminder",
    );
  });
});
