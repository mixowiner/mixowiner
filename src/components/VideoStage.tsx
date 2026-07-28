import { useEffect, useRef, useState } from "react";
import { formatMultiplier } from "@/lib/format";
import { SmoothMultiplier } from "./SmoothMultiplier";
import { GameState } from "@/lib/useCrashGame";

const LOOP_IN_SEC = 2;

export function VideoStage({ gameState }: { gameState: GameState }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (gameState.phase === "preparing") {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
    } else if (gameState.phase === "crashed") {
      v.pause();
    } else if (gameState.phase === "running") {
      try {
        v.currentTime = 0;
      } catch {}
      v.play().catch(() => {});
    }
  }, [gameState.phase]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => setDuration(v.duration || 0);
    const onTimeUpdate = () => {
      if (gameState.phase !== "running" || duration <= 0) return;
      if (v.currentTime >= duration - 0.25) {
        v.currentTime = Math.min(LOOP_IN_SEC, Math.max(0, duration - 0.5));
      }
    };
    const onEnded = () => {
      if (gameState.phase === "running" && duration > 0) {
        v.currentTime = Math.min(LOOP_IN_SEC, Math.max(0, duration - 0.5));
        v.play().catch(() => {});
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [gameState.phase, duration]);

  const prepSeconds = gameState.prepSecondsLeft || 0;
  const prepProgress =
    gameState.prepSecondsLeft !== null
      ? Math.max(0, Math.min(1, gameState.prepSecondsLeft / 8))
      : 1;

  return (
    <div className="relative isolate w-full h-full overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#050914] shadow-2xl flex items-center justify-center">
      <video
        ref={videoRef}
        className="absolute inset-0 z-[1] h-full w-full object-cover opacity-60"
        muted
        playsInline
        preload="auto"
        aria-hidden
      >
        <source src="/game/bgcrash.webm" type="video/webm" />
        <source src="/game/bgcrash.mp4" type="video/mp4" />
      </video>

      {/* Overlays */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_10%,rgba(5,9,20,0.85)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-transparent"
        aria-hidden
      />

      {/* Scanlines */}
      <div
        className="pointer-events-none absolute inset-0 z-[3] opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, #fff 1px, #fff 2px)",
        }}
      />

      {/* Top right badge */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[10] flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
        {gameState.phase === "running" && (
          <>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,240,128,0.8)]" />
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Live</span>
          </>
        )}
        {gameState.phase === "preparing" && (
          <>
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Waiting</span>
          </>
        )}
        {gameState.phase === "crashed" && (
          <>
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[10px] font-bold tracking-widest text-accent uppercase">Crashed</span>
          </>
        )}
      </div>

      <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center">
        {gameState.phase === "preparing" && (
          <div className="flex flex-col items-center text-center w-full h-full">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40">
              <div
                className="h-full bg-gradient-to-r from-primary/50 to-primary shadow-[0_0_15px_var(--color-brand)] transition-all duration-1000 ease-linear"
                style={{ width: `${(1 - prepProgress) * 100}%` }}
              />
            </div>
            <div className="flex flex-col items-center justify-center flex-1">
              <span className="mb-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.3em] text-white/50">
                Next Round
              </span>
              <div className="relative flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="var(--color-brand)"
                    strokeWidth="4"
                    strokeDasharray="289"
                    strokeDashoffset={289 * prepProgress}
                    className="transition-all duration-1000 ease-linear drop-shadow-[0_0_8px_var(--color-brand)]"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-white/90">
                  {prepSeconds}
                </span>
              </div>
            </div>
          </div>
        )}

        {gameState.phase === "running" && (
          <div className="flex flex-col items-center animate-winBurst">
            <SmoothMultiplier className="text-[4rem] sm:text-[6rem] lg:text-[7rem] font-black leading-none tracking-tighter bg-gradient-to-b from-white via-white to-primary bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(0,240,128,0.4)] animate-multiplierGlow" />
            <span className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-white/40">Multiplier</span>
          </div>
        )}

        {gameState.phase === "crashed" && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-accent/40 bg-black/40 px-8 sm:px-12 py-5 sm:py-6 shadow-[0_10px_50px_-10px_rgba(255,62,118,0.5)] backdrop-blur-xl animate-shake">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.3em] text-accent/90">Crashed At</span>
            <span className="text-4xl sm:text-5xl font-black font-mono leading-none tracking-tighter text-accent drop-shadow-[0_0_15px_rgba(255,62,118,0.6)]">
              {formatMultiplier(gameState.multiplier)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
