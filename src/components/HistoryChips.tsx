import { formatMultiplier } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function generateHash(seed: number) {
  return "0x" + Array.from({ length: 16 }, (_, i) =>
    ((Math.sin(seed + i) * 10000) % 16 | 0).toString(16)
  ).join("").toUpperCase();
}

function getColorClasses(mult: number) {
  if (mult >= 10) return "text-accent border-accent/40 bg-accent/10 drop-shadow-[0_0_5px_rgba(255,62,118,0.5)]";
  if (mult >= 5) return "text-purple-400 border-purple-400/40 bg-purple-400/10";
  if (mult >= 2) return "text-primary border-primary/40 bg-primary/10 drop-shadow-[0_0_5px_rgba(0,240,128,0.3)]";
  return "text-white/50 border-white/10 bg-white/5";
}

export function HistoryChips({ history }: { history: number[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [history]);

  if (!history || history.length === 0) {
    return <div className="h-8"></div>;
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto items-center h-8 w-full px-1 no-scrollbar flex-nowrap"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {history.map((mult, idx) => {
          const animationClass = idx === 0 ? "animate-in slide-in-from-right-4 fade-in duration-300" : "";
          return (
            <button
              key={`${idx}-${mult}`}
              onClick={() => setSelected(mult)}
              className={`font-mono font-bold text-xs px-3.5 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 cursor-pointer hover:scale-105 transition-transform ${getColorClasses(mult)} ${animationClass}`}
            >
              {formatMultiplier(mult)}
            </button>
          );
        })}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xs bg-[#0a0f1e] border-white/10 p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-white/90">Round Details</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-0 space-y-3">
            {selected !== null && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Crash Multiplier</span>
                  <span className={`font-mono font-bold text-lg ${getColorClasses(selected).split(' ')[0]}`}>
                    {formatMultiplier(selected)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider font-bold">Server Hash</span>
                  <div className="font-mono text-xs text-white/70 break-all bg-white/5 rounded-lg p-2 border border-white/10">
                    {generateHash(selected * 1000)}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider font-bold">Seed</span>
                  <div className="font-mono text-xs text-white/70 break-all bg-white/5 rounded-lg p-2 border border-white/10">
                    {generateHash(selected * 777)}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
