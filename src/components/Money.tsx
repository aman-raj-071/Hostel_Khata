import { useEffect, useRef } from "react";
import { inr } from "@/lib/format";

export function Money({ amount }: { amount: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 650, 1);
      node.textContent = inr(amount * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount]);
  return (
    <span className="tabular-nums" aria-label={inr(amount)}>
      <span aria-hidden="true" ref={ref}>
        {inr(amount)}
      </span>
    </span>
  );
}
