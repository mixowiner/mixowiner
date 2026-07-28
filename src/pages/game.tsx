import { useCrashGame } from "@/lib/useCrashGame";
import { formatMoney } from "@/lib/format";
import { VideoStage } from "@/components/VideoStage";
import { BetPanel, SoundControls } from "@/components/BetCard";
import { HistoryChips } from "@/components/HistoryChips";
import { HistorySidebar } from "@/components/HistorySidebar";
import { ResultToast } from "@/components/ResultToast";
import { LiveBetsPanel } from "@/components/LiveBetsPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";

export default function GamePage() {
  const {
    balance,
    gameState,
    betState,
    history,
    isConnected,
    soundsMuted,
    musicEnabled,
    placeBet,
    cancelBet,
    cashout,
    toggleSounds,
    toggleMusic,
  } = useCrashGame();
  const [howToOpen, setHowToOpen] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground relative overflow-hidden dark select-none">
      {/* Decorative Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-14 shrink-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 -ml-2">
          <span className="font-black text-xl tracking-tighter text-white/90 leading-none">
            Crash<span className="neon-pink">X</span>
          </span>
        </div>

        <div className="hidden sm:flex flex-1 max-w-md mx-4">
          <HistoryChips history={history} />
        </div>

        <div className="flex items-center gap-3">
          <SoundControls
            soundsMuted={soundsMuted}
            musicEnabled={musicEnabled}
            onToggleSounds={toggleSounds}
            onToggleMusic={toggleMusic}
          />

          <Dialog open={howToOpen} onOpenChange={setHowToOpen}>
            <DialogTrigger asChild>
              <button className="flex h-6 w-6 items-center justify-center hover:opacity-80 transition-opacity">
                <img
                  src="/assets/crash/how-to-play.webp"
                  alt="How to Play"
                  className="w-6 h-6 rounded-full object-cover"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-[#0a0f1e] border-white/10 p-0 overflow-hidden">
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="text-white/90">How to Play</DialogTitle>
              </DialogHeader>
              <div className="p-4 pt-0">
                <img
                  src="/assets/crash/how-to-play.webp"
                  alt="How to Play"
                  className="w-full rounded-xl border border-white/10"
                />
                <ul className="mt-4 space-y-2 text-sm text-white/70">
                  <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Enter your bet amount and auto cashout multiplier.</li>
                  <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Click Bet before the round starts.</li>
                  <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Cash out before the crash to win. The longer you wait, the bigger the payout.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 shadow-inner whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isConnected
                  ? "bg-primary shadow-[0_0_8px_rgba(0,240,128,0.8)]"
                  : "bg-destructive"
              }`}
            />
            <span className="font-mono font-bold text-sm text-white/90">{formatMoney(balance)}</span>
          </div>
        </div>
      </header>

      {/* Mobile History (visible only on small screens) */}
      <div className="sm:hidden px-4 py-1 border-b border-white/5 bg-background/50 backdrop-blur-sm shrink-0">
        <HistoryChips history={history} />
      </div>

      {/* Main Area */}
      <main className="flex-1 min-h-0 max-w-[1440px] w-full mx-auto p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 relative z-10 overflow-hidden">
        {/* Left Column */}
        <div className="flex flex-col gap-3 h-full overflow-hidden">
          <div className="flex-1 min-h-[160px] overflow-hidden flex gap-3">
            <div className="flex-1 overflow-hidden rounded-2xl sm:rounded-3xl">
              <VideoStage gameState={gameState} />
            </div>
            <HistorySidebar history={history} />
          </div>
          <div className="shrink-0">
            <BetPanel
              balance={balance}
              gameState={gameState}
              betState={betState}
              onPlaceBet={(slot, stake, autoCashout) => placeBet(slot, stake, autoCashout)}
              onCancelBet={(slot) => cancelBet(slot)}
              onCashout={(slot) => cashout(slot)}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="hidden lg:block h-full min-h-0">
          <LiveBetsPanel gameState={gameState} />
        </div>
      </main>

      <ResultToast betState={betState} />
    </div>
  );
}
