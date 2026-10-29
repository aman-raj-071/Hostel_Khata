export type VoiceRoute =
  "/" | "/balances" | "/settle" | "/history" | "/report" | "/members" | "/review";
export type VoiceCommand =
  | { kind: "navigate"; to: VoiceRoute }
  | { kind: "click"; target: string }
  | { kind: "write" | "search"; text: string }
  | { kind: "scroll"; direction: "up" | "down" }
  | {
      kind:
        "stop" | "help" | "clear" | "dictate" | "end-dictation" | "confirm" | "cancel" | "unknown";
    };

export const voiceDigits = (text: string) =>
  text.replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));
export const voiceWords = (text: string) =>
  voiceDigits(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}@.\s-]/gu, " ")
    .replace(/[.।!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

const routes: Record<string, VoiceRoute> = {
  add: "/",
  home: "/",
  "add expense": "/",
  "नया खर्चा": "/",
  होम: "/",
  ऐड: "/",
  balances: "/balances",
  balance: "/balances",
  बैलेंस: "/balances",
  बैलेंसस: "/balances",
  हिसाब: "/balances",
  settle: "/settle",
  "settle up": "/settle",
  settlement: "/settle",
  सेटल: "/settle",
  "सेटल अप": "/settle",
  history: "/history",
  हिस्ट्री: "/history",
  "पुराने खर्चे": "/history",
  report: "/report",
  रिपोर्ट: "/report",
  members: "/members",
  member: "/members",
  मेंबर्स: "/members",
  सदस्य: "/members",
  review: "/review",
  रिव्यू: "/review",
};
const numbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
};

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const text = voiceWords(transcript);
  if (/^(stop listening|stop voice|mic band|माइक बंद|माइक बंद करो|voice band|वॉइस बंद)$/.test(text))
    return { kind: "stop" };
  if (/^(stop dictation|end dictation|likhna band|लिखना बंद|लिखना बंद करो)$/.test(text))
    return { kind: "end-dictation" };
  if (/^(start dictation|dictation|likhna shuru|लिखना शुरू|लिखना शुरू करो)$/.test(text))
    return { kind: "dictate" };
  const write = transcript.trim().match(/^(?:type|write|likho|लिखो|लिख दो)\s+(.+)$/iu);
  if (write) return { kind: "write", text: write[1]!.trim() };
  const search = transcript.trim().match(/^(?:search for|search|dhundo|ढूंढो|खोजो|सर्च)\s+(.+)$/iu);
  if (search) return { kind: "search", text: search[1]!.trim() };
  const page = text
    .replace(/^(?:open|show|go to|kholo|dikhao|खोलो|दिखाओ)\s+/, "")
    .replace(/\s+(?:page|page kholo|kholo|dikhao|खोलो|दिखाओ|पर जाओ)$/, "");
  if (routes[page]) return { kind: "navigate", to: routes[page] };
  if (/^(help|madad|मदद|voice help|कमांड दिखाओ)$/.test(text)) return { kind: "help" };
  if (/^(clear|clear field|saaf karo|साफ करो|मिटाओ)$/.test(text)) return { kind: "clear" };
  if (/^(confirm|haan|हाँ|हां|पक्का|confirm karo|कन्फर्म)$/.test(text)) return { kind: "confirm" };
  if (/^(cancel|close|रद्द|बंद करो|नहीं|nahi)$/.test(text)) return { kind: "cancel" };
  if (/^(scroll down|neeche|neeche jao|नीचे|नीचे जाओ)$/.test(text))
    return { kind: "scroll", direction: "down" };
  if (/^(scroll up|upar|upar jao|ऊपर|ऊपर जाओ)$/.test(text))
    return { kind: "scroll", direction: "up" };
  if (/^(parse|parse karo|पार्स|पार्स करो|समझो)$/.test(text))
    return { kind: "click", target: "parse" };
  if (/^(save|save karo|save all|save changes|सेव|सेव करो|सेव ऑल)$/.test(text))
    return { kind: "click", target: "save" };
  const click =
    text.match(/^(?:click|press|button|number|dabao|बटन|नंबर|दबाओ|क्लिक)\s+(.+)$/u) ??
    text.match(/^(.+?)\s+(?:dabao|दबाओ|पर क्लिक करो)$/u);
  if (click) return { kind: "click", target: String(numbers[click[1]!] ?? click[1]!) };
  return { kind: "unknown" };
}

export interface VoiceTarget {
  element: HTMLElement;
  label: string;
}
const controlSelector =
  'a[href],button,input:not([type="hidden"]),textarea,select,[role="combobox"],[role="option"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="tab"]';
export function voiceLabel(element: HTMLElement): string {
  const labelledBy = element
    .getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  const labels =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
      ? [...(element.labels ?? [])].map((label) => label.textContent).join(" ")
      : "";
  return (
    element.getAttribute("aria-label") ||
    labelledBy ||
    labels ||
    element.getAttribute("placeholder") ||
    element.innerText ||
    element.textContent ||
    element.getAttribute("title") ||
    element.tagName
  ).trim();
}
export function getVoiceTargets(): VoiceTarget[] {
  return [...document.querySelectorAll<HTMLElement>(controlSelector)]
    .filter(
      (element) =>
        !element.closest('[data-voice-ui],[aria-hidden="true"],[hidden],[inert]') &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    )
    .map((element) => ({ element, label: voiceLabel(element) }));
}

export function scrollVoicePage(direction: "up" | "down") {
  const contexts = [
    ...document.querySelectorAll<HTMLElement>(
      '[role="dialog"],[role="alertdialog"],[role="listbox"]',
    ),
  ].filter((e) => e.getClientRects().length && !e.closest('[aria-hidden="true"]'));
  const context = contexts.at(-1);
  const scrollable =
    context &&
    [context, ...context.querySelectorAll<HTMLElement>("*")].find(
      (e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight,
    );
  const amount =
    (direction === "down" ? 1 : -1) * (scrollable?.clientHeight || window.innerHeight) * 0.65;
  if (scrollable) scrollable.scrollBy({ top: amount, behavior: "smooth" });
  else window.scrollBy({ top: amount, behavior: "smooth" });
}

export function findVoiceTarget(targets: VoiceTarget[], spoken: string): VoiceTarget {
  const word = voiceWords(spoken);
  if (/^\d+$/.test(word)) {
    const target = targets[Number(word) - 1];
    if (!target) throw new Error("Yeh number screen par nahi hai. Dikh raha number bolo.");
    return target;
  }
  const exact = targets.filter((t) => voiceWords(t.label) === word);
  const matches = exact.length ? exact : targets.filter((t) => voiceWords(t.label).includes(word));
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "Ek se zyada controls mile. Uska number bolo: click 5."
        : "Yeh control nahi mila. Screen ka number bolo: click 5.",
    );
  return matches[0]!;
}

export function activateVoiceTarget({ element, label }: VoiceTarget) {
  if (!element.isConnected || element.closest('[aria-hidden="true"],[hidden],[inert]'))
    throw new Error("Screen badal gayi. Naya number bolo.");
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true")
    throw new Error("Yeh button abhi ready nahi hai. Pehle zaroori fields bharo.");
  element.scrollIntoView?.({ block: "center", behavior: "smooth" });
  element.focus();
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  )
    return `${label}: ab “likho …” bolo.`;
  if (
    element.matches('[role="combobox"],[aria-haspopup="menu"],[role="option"],[role="menuitem"]')
  ) {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  } else element.click();
  return `${label} chuna.`;
}

export function getVoiceInput(
  targets: VoiceTarget[],
  search = false,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const inputs = targets
    .map((t) => t.element)
    .filter(
      (element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement ||
        (element instanceof HTMLInputElement &&
          !["checkbox", "radio", "button", "submit", "file", "password"].includes(element.type)),
    );
  if (search) {
    const field = inputs.find((e) => /search/i.test(voiceLabel(e)));
    if (field) return field;
    throw new Error("Search ke liye pehle History kholo.");
  }
  const focused = inputs.find((e) => e === document.activeElement);
  if (focused) return focused;
  if (inputs.length === 1) return inputs[0]!;
  throw new Error("Pehle field ka number bolo: click 5. Phir “likho …” bolo.");
}

export function writeVoiceInput(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  text: string,
  append = false,
) {
  let value = text;
  if (field instanceof HTMLInputElement && field.type === "number" && text) {
    value = voiceDigits(text)
      .replace(/^(?:₹|rs\.?)\s*/i, "")
      .replace(/\s*(?:rupees|रुपये|रुपए)$/i, "")
      .trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(value))
      throw new Error("Amount number mein bolo, jaise 500 ya 500.50.");
  }
  if (field instanceof HTMLInputElement && field.type === "date" && text) {
    value = voiceDigits(text)
      .replace(/\s*(?:dash|hyphen|डैश)\s*/gi, "-")
      .trim();
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new Error("Date aise bolo: 2026 dash 10 dash 29.");
  }
  if (/upi/i.test(voiceLabel(field)))
    value = value
      .replace(/\s+(?:at|एट)\s+/gi, "@")
      .replace(/\s+(?:dot|डॉट)\s+/gi, ".")
      .replace(/\s/g, "");
  if (field instanceof HTMLSelectElement) {
    const options = [...field.options].filter(
      (option) =>
        !option.disabled &&
        [voiceWords(option.label), voiceWords(option.value)].includes(voiceWords(value)),
    );
    if (options.length !== 1)
      throw new Error("Option nahi mila. Dropdown kholo aur option ka number bolo.");
    value = options[0]!.value;
  } else if (append) {
    if (field instanceof HTMLInputElement && ["number", "date"].includes(field.type))
      throw new Error("Is field ke liye “likho” ke baad poori value bolo.");
    value = [field.value, value].filter(Boolean).join(" ");
  }
  if (field.matches(":disabled") || (!(field instanceof HTMLSelectElement) && field.readOnly))
    throw new Error("Yeh field abhi edit nahi ho sakti.");
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  return `${voiceLabel(field)} update hua.`;
}
