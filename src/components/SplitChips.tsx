import { inr } from "@/lib/format";
import { Avatar } from "@/components/States";

export interface ChipItem {
  key: string;
  label: string;
  selected: boolean;
  share?: number | undefined;
}

export function SplitChips({
  items,
  onToggle,
}: {
  items: ChipItem[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onToggle(it.key)}
          aria-pressed={it.selected}
          className={`flex min-h-11 flex-col items-start rounded-2xl border px-3 py-1.5 text-left text-sm transition-colors ${
            it.selected
              ? "border-primary bg-secondary text-secondary-foreground"
              : "border-border bg-card text-muted-foreground line-through"
          }`}
        >
          <span className="flex items-center gap-2 font-semibold">
            <Avatar name={it.label} />
            {it.label}
          </span>
          {it.selected && it.share !== undefined && (
            <span className="text-xs">{inr(it.share)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function splitEqually<T>(
  amount: number,
  keys: T[],
  payer?: T,
): { key: T; amount: number }[] {
  if (!keys.length) return [];
  const paise = Math.max(0, Math.round(amount * 100));
  const each = Math.floor(paise / keys.length);
  const remainderKey = keys.includes(payer as T) ? payer : keys[0];
  return keys.map((key) => ({
    key,
    amount: (each + (key === remainderKey ? paise % keys.length : 0)) / 100,
  }));
}
