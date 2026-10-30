import Anthropic from "@anthropic-ai/sdk";
import type { Member, ReminderInput } from "../../src/lib/types.js";
import { REMINDER_SYSTEM_PROMPT } from "../prompts/reminderPrompt.js";
import { HttpError } from "./errors.js";
import { toPaise, toRupees } from "./money.js";
import { reminderInput, reminderSchema } from "./schemas.js";

export async function generateReminder(input: ReminderInput, members: Member[]) {
  const data = reminderInput.parse(input);
  const from = members.find((member) => member.id === data.fromId);
  const to = members.find((member) => member.id === data.toId);
  if (!from || !to) throw new HttpError(422, "Choose only members of this group for the reminder.");
  const paise = toPaise(data.amount);
  const amount = `₹${toRupees(paise).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const upi = to.upiId
    ? "UPI available hai — jab ho sake bhej dena."
    : `${to.name}, UPI available hai? Apni UPI ID share kar do.`;
  let message: string;
  if (process.env.USE_CLAUDE_STUB === "true") {
    const variants = {
      polite: [
        `Hi ${from.name}, jab convenient ho ${to.name} ko ${amount} bhej dena, please. Shukriya!`,
        `${from.name}, ek chhota reminder: ${to.name} ke ${amount} baaki hain. Time mile toh settle kar dena 🙂`,
      ],
      filmy: [
        `${from.name}, picture abhi baaki hai mere dost… ${to.name} ko ${amount} bhejo aur happy ending lao! 🎬`,
        `${from.name}, dosti mein no sorry, no thank you… par ${to.name} ke ${amount} ka hisaab toh banta hai! 🎥`,
      ],
      mummy: [
        `${from.name}, khana kha liya? Ab ${to.name} ke ${amount} bhi bhej do, beta. Khata bhi aaram karega 😌`,
        `${from.name}, mummy ki ek baat maan lo: ${to.name} ke ${amount} settle kar do, phir araam se reels dekhna 🙂`,
      ],
      savage: [
        `${from.name}, khata loading pe atka hai… ${to.name} ko ${amount} bhejo aur progress bar complete karo 😂`,
        `${from.name}, ${to.name} ke ${amount} ka season finale kab aayega? Ek payment aur credits roll! 🍿`,
      ],
    };
    const variant =
      Array.from(data.fromId + data.toId).reduce((sum, char) => sum + char.charCodeAt(0), paise) %
      2;
    message = `${variants[data.tone][variant]}\n${upi}`;
  } else {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new HttpError(503, "ANTHROPIC_API_KEY not configured");
    if (!process.env.ANTHROPIC_MODEL) throw new HttpError(503, "ANTHROPIC_MODEL not configured");
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30000,
      maxRetries: 0,
    });
    try {
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL,
        system: REMINDER_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              debtor: from.name,
              creditor: to.name,
              amount,
              tone: data.tone,
              upiAvailable: Boolean(to.upiId),
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });
      if (response.stop_reason !== "end_turn") throw new Error("Incomplete reminder");
      message = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      if (
        ![from.name, to.name, amount].every((value) => message.includes(value)) ||
        !/upi/i.test(message)
      )
        throw new Error("Missing reminder facts");
    } catch {
      throw new HttpError(502, "Couldn't generate the reminder. Please try again shortly.");
    }
  }
  const result = reminderSchema.safeParse({ message });
  if (!result.success)
    throw new HttpError(502, "Couldn't generate a short reminder. Please try again.");
  return result.data;
}
