import { BetState } from "@/lib/useCrashGame";
import { formatMoney, formatMultiplier } from "@/lib/format";
import { useEffect, useState } from "react";

function lastResolved(betState: BetState) {
  const entries = [
    { key: 'A', bet: betState.a },
    { key: 'B', bet: betState.b }
  ];
  const resolved = entries.filter(e => e.bet.status === 'won' || e.bet.status === 'lost');
  if (resolved.length === 0) return null;
  return resolved;
}

export function ResultToast({ betState }: { betState: BetState }) {
  const [show, setShow] = useState(false);
  const [lastWin, setLastWin] = useState<{ key: string; bet: BetState['a'] } | null>(null);

  useEffect(() => {
    const resolved = lastResolved(betState);
    const win = resolved?.find(e => e.bet.status === 'won') ?? null;
    if (win) {
      setLastWin(win);
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [betState]);

  if (!show || !lastWin) return null;
  const payout = (lastWin.bet as any).payout as number;
  const multiplier = (lastWin.bet as any).multiplier as number;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-6 fade-in duration-300 pointer-events-none">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/60 bg-primary/10 text-primary shadow-[0_10px_40px_-10px_rgba(0,240,128,0.5)] backdrop-blur-xl">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">Win</span>
        <span className="text-sm font-black font-mono tracking-tighter drop-shadow-md">+{formatMoney(payout)}</span>
        <span className="text-[10px] font-bold text-white/60">@ {formatMultiplier(multiplier)}</span>
      </div>
    </div>
  );
}
