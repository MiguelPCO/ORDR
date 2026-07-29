"use client";

import { useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Ring } from "@/components/features/score-ring";
import type { AnalyzeResponse, Verdict } from "@/schemas";

export function AnalyzeHeroCard({ dishes }: { dishes: AnalyzeResponse["dishes"] }) {
  const counts: Record<Verdict, number> = { green: 0, amber: 0, red: 0 };
  for (const d of dishes) counts[d.verdict]++;
  const [progress, setProgress] = useState(0);

  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setProgress(1);
      return;
    }
    const obj = { p: 0 };
    gsap.to(obj, {
      p: 1,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => setProgress(obj.p),
    });
  }, [dishes]);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border border-line p-6 text-center"
      style={{ backgroundImage: "linear-gradient(135deg, var(--grad-hero-from), var(--grad-hero-to))" }}
    >
      <div className="relative inline-flex items-center justify-center">
        <Ring
          segments={[
            { value: counts.green, colorVar: "var(--color-sem-green)" },
            { value: counts.amber, colorVar: "var(--color-sem-amber)" },
            { value: counts.red, colorVar: "var(--color-sem-red)" },
          ]}
          size={140}
          strokeWidth={12}
          progress={progress}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-donut font-bold leading-none text-ink tabular-nums">
            {counts.green}
          </span>
          <span className="text-caption uppercase tracking-wide text-ink-soft">en verde</span>
        </div>
      </div>
      <p className="text-body-sm text-ink-soft">
        {dishes.length} plato{dishes.length === 1 ? "" : "s"} analizados
      </p>
    </div>
  );
}
