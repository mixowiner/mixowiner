import { useEffect, useRef, useState } from "react";
import { formatMultiplier } from "@/lib/format";
import { SmoothMultiplier } from "./SmoothMultiplier";
import { GameState } from "@/lib/useCrashGame";

const LOOP_IN_SEC = 2;

export function VideoStage({ gameState }: { gameState: GameState }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  // Live countdown calculated from bettingClosesAt timestamp
  const [liveCountdown, setLiveCountdown] = useState<number>(0);

  // Live countdown ticker - uses bettingClosesAt for accuracy
  useEffect(() => {
    if (gameState.phase !== "preparing") {
      setLiveCountdown(0);
      return;
    }

    const tick = () => {
      if (gameState.bettingClosesAt) {
        const remaining = (new Date(gameState.bettingClosesAt).getTime() - Date.now()) / 1000;
        setLiveCountdown(Math.max(0, remaining));
      } else if (gameState.prepSecondsLeft !== null) {
        setLiveCountdown(Math.max(0, gameState.prepSecondsLeft));
      }
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [gameState.phase, gameState.bettingClosesAt, gameState.prepSecondsLeft]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (gameState.phase === "preparing") {
      v.pause();
      try { v.currentTime = 0; } catch {}
    } else if (gameState.phase === "crashed") {
      v.pause();
    } else if (gameState.phase === "running") {
      try { v.currentTime = 0; } catch {}
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

  const prepSeconds = Math.ceil(liveCountdown);
  const prepProgress = gameState.bettingClosesAt
    ? Math.max(0, Math.min(1, liveCountdown / 7))
    : gameState.prepSecondsLeft !== null
    ? Math.max(0, Math.min(1, gameState.prepSecondsLeft / 8))
    : 1;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
      <video
        ref={videoRef}
        src="/rocket.mp4"
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)' }} />

      {/* Top right badge */}
      <div className="absolute top-3 right-3 z-10">
        {gameState.phase === "running" && (
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          </>
        )}
        {gameState.phase === "preparing" && (
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Waiting
            </span>
          </>
        )}
        {gameState.phase === "crashed" && (
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Crashed
            </span>
          </>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10">
        {gameState.phase === "preparing" && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                <circle
                  cx="48" cy="48" r="40" fill="none"
                  stroke="rgba(251,191,36,0.9)" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - prepProgress)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Next Round</span>
                <span className="text-white text-3xl font-black tabular-nums leading-none">{prepSeconds}</span>
              </div>
            </div>
          </div>
        )}

        {gameState.phase === "running" && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-white/50 text-sm font-semibold uppercase tracking-widest">Multiplier</span>
            <SmoothMultiplier />
          </div>
        )}

        {gameState.phase === "crashed" && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-red-400/80 text-sm font-semibold uppercase tracking-widest">Crashed At</span>
            <span className="text-red-400 text-5xl font-black drop-shadow-lg">
              {formatMultiplier(gameState.multiplier)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
