import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, memberName } from "@/lib/format";
import { useGroup, useWrapped } from "@/lib/queries";

export const Route = createFileRoute("/wrapped")({
  head: () => ({
    meta: [
      { title: "Hostel Wrapped — Hostel Khata" },
      { name: "description", content: "Your flat's month in money, chai and friendly awards." },
    ],
  }),
  component: WrappedPage,
});

const backgrounds = [
  "linear-gradient(145deg,#5b21b6,#111827)",
  "linear-gradient(145deg,#b45309,#451a03)",
  "linear-gradient(145deg,#9f1239,#2e1065)",
  "linear-gradient(145deg,#065f46,#172554)",
];
export function WrappedPage() {
  const { data: group } = useGroup();
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  });
  const [month, setMonth] = useState(months[0]!.value);
  const [index, setIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const capture = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const query = useWrapped(month);
  const data = query.data;
  const cards = !data
    ? []
    : [
        {
          emoji: "🏠",
          title: `${group?.name ?? "Hostel"} Wrapped`,
          value: inr(data.total),
          line: "Ek mahina. Hazaar yaadein. Aur thoda sa hisaab.",
          memberId: null,
        },
        ...data.awards.map((award) => ({
          ...award,
          value:
            award.title === "Chai ka Raja"
              ? `${award.value} rounds`
              : award.title === "Sabse late payer"
                ? `${award.value} days`
                : inr(award.value),
        })),
        {
          emoji: "🧾",
          title: "Biggest expense",
          value: data.biggestExpense ? inr(data.biggestExpense.amount) : "No expense",
          line: data.biggestExpense
            ? `${data.biggestExpense.description} · ${data.biggestExpense.date}`
            : "Khata abhi khaali hai.",
          memberId: data.biggestExpense?.payerId ?? null,
        },
        {
          emoji: "🫶",
          title: "Hisaab clear. Dosti dear.",
          value: inr(data.total),
          line: data.awards
            .filter((award) => award.memberId)
            .map(
              (award) =>
                `${award.emoji} ${award.title}: ${memberName(group?.members, award.memberId!)}`,
            )
            .join("\n"),
          memberId: null,
        },
      ];
  const current = Math.min(index, Math.max(cards.length - 1, 0));
  const card = cards[current];
  const move = (direction: number) =>
    setIndex((value) => Math.max(0, Math.min(cards.length - 1, value + direction)));

  async function share() {
    if (!capture.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(capture.current, {
        pixelRatio: 2,
        fontEmbedCSS: "",
        style: { fontFamily: "Arial, sans-serif" },
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = `hostel-wrapped-${month}-${current + 1}.png`;
      link.click();
      toast.success("PNG ready — share it with your gang");
    } catch {
      toast.error("Couldn't export this card. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageTitle title="Hostel Wrapped" subtitle="Your month. Your gang. Your legendary khata." />
      <Select
        value={month}
        onValueChange={(value) => {
          setMonth(value);
          setIndex(0);
        }}
      >
        <SelectTrigger aria-label="Wrapped month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {query.isLoading ? (
        <ListSkeleton rows={1} h="h-96" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !data?.total || !card ? (
        <EmptyState
          emoji="🎬"
          title="Your story starts with a kharcha"
          body="Choose another month or add your first expense."
        />
      ) : (
        <>
          <div className="flex gap-1" aria-label={`Story ${current + 1} of ${cards.length}`}>
            {cards.map((_, position) => (
              <button
                key={position}
                aria-label={`Story ${position + 1}`}
                aria-current={position === current ? "step" : undefined}
                onClick={() => setIndex(position)}
                className="min-h-6 flex-1 py-2"
              >
                <span
                  className={`block h-1 rounded-full ${position <= current ? "bg-primary" : "bg-muted"}`}
                />
              </button>
            ))}
          </div>
          <div className="relative">
            <div
              ref={capture}
              tabIndex={0}
              role="region"
              aria-label="Wrapped story"
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") move(1);
                if (event.key === "ArrowLeft") move(-1);
              }}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(event) => {
                const touch = event.changedTouches[0],
                  start = touchStart.current;
                touchStart.current = null;
                if (
                  touch &&
                  start &&
                  Math.abs(touch.clientX - start.x) > 45 &&
                  Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y)
                )
                  move(touch.clientX < start.x ? 1 : -1);
              }}
              className="story-card flex min-h-[65dvh] flex-col items-center justify-center rounded-[2rem] px-8 py-14 text-center text-white shadow-2xl"
              style={{ background: backgrounds[current % backgrounds.length] }}
            >
              <p className="mb-7 text-xs font-semibold uppercase tracking-[.25em]">
                Hostel Khata · {month}
              </p>
              <span className="text-7xl" aria-hidden="true">
                {card.emoji}
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold">{card.title}</h2>
              {card.memberId && (
                <div className="mt-4 flex items-center gap-2">
                  <Avatar name={memberName(group?.members, card.memberId)} />
                  <span className="font-semibold">{memberName(group?.members, card.memberId)}</span>
                </div>
              )}
              <p className="my-5 w-full break-words font-display text-[clamp(1.5rem,7vw,3rem)] font-bold tracking-tight">
                {card.value}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">
                {card.line}
              </p>
              <p className="mt-8 text-xs text-white/60">
                {current + 1} / {cards.length} · Dosti stays priceless
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              aria-label="Previous story"
              disabled={current === 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button className="h-12 flex-1 rounded-xl" disabled={exporting} onClick={share}>
              <Download />
              {exporting ? "Exporting…" : "Share PNG"}
            </Button>
            <Button
              variant="outline"
              aria-label="Next story"
              disabled={current === cards.length - 1}
              onClick={() => move(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Swipe, tap a progress segment, or use arrow keys. Awards are friendly fun; debt age uses
            net FIFO balances.
          </p>
        </>
      )}
    </div>
  );
}
