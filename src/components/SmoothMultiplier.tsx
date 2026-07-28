import { useEffect, useRef } from "react";
import { formatMultiplier } from "@/lib/format";
import { gameSync } from "@/lib/useCrashGame";

export function SmoothMultiplier({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let rafId: number;

    const loop = () => {
      if (gameSync.phase === "running") {
        // Simple exponential extrapolation capped to avoid overshooting too far past server
        const dt = Math.max(0, performance.now() - gameSync.lastTickMs) / 1000;
        const est = gameSync.serverMultiplier * Math.exp(0.06 * Math.min(dt, 0.25));
        
        gameSync.visualMultiplier = Math.max(gameSync.visualMultiplier, gameSync.serverMultiplier);
        
        if (est > gameSync.visualMultiplier) {
          gameSync.visualMultiplier = est;
        }

        node.textContent = formatMultiplier(gameSync.visualMultiplier);
      } else {
        node.textContent = formatMultiplier(gameSync.serverMultiplier);
        gameSync.visualMultiplier = gameSync.serverMultiplier;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <span ref={ref} className={`numeric tabular-nums ${className || ''}`} aria-hidden />;
}
