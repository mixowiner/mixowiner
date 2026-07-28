import { GameState, SingleBetState, gameSync } from "@/lib/useCrashGame";
import { formatMoney, formatMultiplier } from "@/lib/format";
import { useState, useEffect, useRef } from "react";
import { Rocket, Volume2, VolumeX, Music, Music2 } from "lucide-react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeMultiplier(raw: string) {
  let s = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s;
}

function multiplierFromInput(s: string) {
  const clean = sanitizeMultiplier(s);
  if (clean === "" || clean === ".") return 2;
  const base = clean.endsWith(".") ? clean.slice(0, -1) : clean;
  const n = Number(base);
  if (!Number.isFinite(n)) return 2;
  return clamp(n, 1.01, 1000);
}

export function SoundControls({
  soundsMuted,
  musicEnabled,
  onToggleSounds,
  onToggleMusic,
}: {
  soundsMuted: boolean;
  musicEnabled: boolean;
  onToggleSounds: () => void;
  onToggleMusic: () => void;
}) {
  return (
    <div className="flex items-center gap-3 ml-2">
      <button
        onClick={onToggleSounds}
        className={`flex h-6 w-6 items-center justify-center transition-colors ${
          soundsMuted ? "text-white/60 hover:text-white" : "text-primary neon-green"
        }`}
        title={soundsMuted ? "Unmute sounds" : "Mute sounds"}
      >
        {soundsMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      <button
        onClick={onToggleMusic}
        className="flex h-6 w-6 items-center justify-center text-white/60 hover:text-white transition-colors"
        title={musicEnabled ? "Disable music" : "Enable music"}
      >
        {musicEnabled ? <Music2 className="w-5 h-5 neon-green" /> : <Music className="w-5 h-5" />}
      </button>
    </div>
  );
}

function LiveProfit({ stake }: { stake: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let rafId: number;

    const loop = () => {
      if (gameSync.phase === "running") {
        node.textContent = formatMoney(stake * gameSync.visualMultiplier);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [stake]);

  return <span ref={ref} className="font-mono text-base font-black text-primary drop-shadow-[0_0_8px_rgba(0,240,128,0.5)] tabular-nums" />;
}

function statusLabel(status: SingleBetState["status"]) {
  switch (status) {
    case "idle":
      return "Ready";
    case "pending":
      return "Pending";
    case "active":
      return "Flying";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    default:
      return "Ready";
  }
}

function BetRow({
  balance,
  gameState,
  betState,
  onPlaceBet,
  onCancelBet,
  onCashout,
}: {
  balance: number;
  gameState: GameState;
  betState: SingleBetState;
  onPlaceBet: (stake: number, autoCashout: number) => void;
  onCancelBet: () => void;
  onCashout: () => void;
}) {
  const [stake, setStake] = useState(10);
  const [autoCashout, setAutoCashout] = useState("2.00");

  const parsedAuto = multiplierFromInput(autoCashout);
  const canInteract = betState.status === "idle" || betState.status === "pending";
  const inputsDisabled = !canInteract || (gameState.phase !== "preparing" && gameState.phase !== "running");
  const isNextRound = gameState.phase === "running" && betState.status === "idle";

  let cta = null;
  if (gameState.phase === "preparing" || gameState.phase === "running") {
    if (betState.status === "pending") {
      cta = (
        <button
          className="h-12 rounded-xl font-bold text-sm border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition-colors px-5"
          onClick={onCancelBet}
        >
          Cancel
        </button>
      );
    } else if (betState.status === "active") {
      cta = (
        <button
          className="h-12 rounded-xl bg-gradient-to-r from-orange-500 to-[#ff3e76] text-white flex flex-col items-center justify-center font-black transition-all animate-cashPulse hover:opacity-90 shadow-lg px-5 leading-tight"
          onClick={onCashout}
        >
          <span className="text-[10px] uppercase tracking-wider opacity-90">Cash</span>
          <LiveProfit stake={(betState as any).stake} />
        </button>
      );
    } else if (betState.status === "idle") {
      cta = (
        <button
          className="h-12 rounded-xl bg-primary text-black hover:bg-primary/90 flex items-center justify-center gap-1.5 font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed px-5 hover:shadow-[0_0_20px_rgba(0,240,128,0.3)]"
          onClick={() => onPlaceBet(stake, parsedAuto)}
          disabled={stake <= 0 || stake > balance}
        >
          <Rocket className="w-4 h-4" />
          {isNextRound ? "Next" : "Bet"}
        </button>
      );
    } else {
      cta = (
        <button disabled className="h-12 rounded-xl border border-white/10 bg-white/5 text-white/40 font-bold text-sm cursor-not-allowed px-5">
          Wait
        </button>
      );
    }
  } else {
    cta = (
      <button disabled className="h-12 rounded-xl border border-white/10 bg-white/5 text-white/40 font-bold text-sm cursor-not-allowed px-5">
        Wait
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            betState.status === "active"
              ? "bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(255,122,50,0.8)]"
              : betState.status === "pending"
              ? "bg-primary animate-pulse shadow-[0_0_8px_rgba(0,240,128,0.8)]"
              : betState.status === "won"
              ? "bg-primary"
              : betState.status === "lost"
              ? "bg-accent"
              : "bg-white/20"
          }`}
        />
        <span className="text-xs font-black uppercase tracking-wider text-white/70">{statusLabel(betState.status)}</span>
      </div>

      <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-1 focus-within:border-primary/50 transition-colors shadow-inner">
        <span className="pl-3 text-white/30 font-bold text-xs">AMT</span>
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
          disabled={inputsDisabled}
          className="w-full bg-transparent border-none outline-none text-base font-black font-mono px-2 text-white disabled:opacity-50"
        />
        <button
          className="h-8 w-9 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold disabled:opacity-50 transition-colors text-xs"
          disabled={inputsDisabled}
          onClick={() => setStake((s) => Math.max(1, +(s / 2).toFixed(2)))}
        >
          ½
        </button>
        <button
          className="h-8 w-9 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold disabled:opacity-50 transition-colors text-xs mr-1"
          disabled={inputsDisabled}
          onClick={() => setStake((s) => Math.min(balance, +(s * 2).toFixed(2)))}
        >
          2×
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-1 focus-within:border-primary/50 transition-colors shadow-inner">
          <span className="pl-3 text-white/30 font-bold text-xs">AUTO</span>
          <input
            type="text"
            inputMode="decimal"
            value={autoCashout}
            onChange={(e) => setAutoCashout(sanitizeMultiplier(e.target.value))}
            disabled={inputsDisabled}
            className="w-full bg-transparent border-none outline-none text-base font-black font-mono px-2 text-white disabled:opacity-50"
          />
          <span className="pr-3 text-white/30 font-black text-xs">×</span>
        </div>
        {cta}
      </div>
    </div>
  );
}

export function BetPanel({
  balance,
  gameState,
  betState,
  onPlaceBet,
  onCancelBet,
  onCashout,
}: {
  balance: number;
  gameState: GameState;
  betState: { a: SingleBetState; b: SingleBetState };
  onPlaceBet: (slot: "a" | "b", stake: number, autoCashout: number) => void;
  onCancelBet: (slot: "a" | "b") => void;
  onCashout: (slot: "a" | "b") => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl p-3 shadow-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BetRow
          balance={balance}
          gameState={gameState}
          betState={betState.a}
          onPlaceBet={(stake, autoCashout) => onPlaceBet("a", stake, autoCashout)}
          onCancelBet={() => onCancelBet("a")}
          onCashout={() => onCashout("a")}
        />
        <BetRow
          balance={balance}
          gameState={gameState}
          betState={betState.b}
          onPlaceBet={(stake, autoCashout) => onPlaceBet("b", stake, autoCashout)}
          onCancelBet={() => onCancelBet("b")}
          onCashout={() => onCashout("b")}
        />
      </div>
    </div>
  );
}
