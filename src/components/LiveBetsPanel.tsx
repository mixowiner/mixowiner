import { useState, useEffect } from "react";
import { GameState, gameSync } from "@/lib/useCrashGame";
import { formatMoney, formatMultiplier } from "@/lib/format";
import { Users } from "lucide-react";

type MockPlayer = {
  id: string;
  username: string;
  avatar: string;
  stake: number;
  cashoutMult: number | null;
  status: 'betting' | 'active' | 'cashed' | 'lost';
};

const USERNAMES = ["0x4f2a", "SatoshiK", "moon_ape99", "DegenTrader", "Whale_Alert", "cryptobro", "pepe_fan", "vitalik_jr", "laser_eyes", "hodl_gang", "bull_run_21"];

function generateMockPlayers(count: number): MockPlayer[] {
  return Array.from({ length: count }).map((_, i) => {
    const username = USERNAMES[Math.floor(Math.random() * USERNAMES.length)] + Math.floor(Math.random() * 999);
    const stake = [10, 25, 50, 100, 250, 500][Math.floor(Math.random() * 6)];
    const cashoutMult = Math.random() > 0.3 ? 1 + Math.random() * 3 : null; // Some will crash/lose
    
    return {
      id: `mock-${i}`,
      username,
      avatar: username.substring(0, 2).toUpperCase(),
      stake,
      cashoutMult,
      status: 'betting' as const
    };
  }).sort((a, b) => b.stake - a.stake);
}

export function LiveBetsPanel({ gameState }: { gameState: GameState }) {
  const [players, setPlayers] = useState<MockPlayer[]>([]);
  const [onlineCount, setOnlineCount] = useState(342);

  // Initialize round players
  useEffect(() => {
    if (gameState.phase === 'preparing') {
      setPlayers(generateMockPlayers(12));
      setOnlineCount(Math.floor(200 + Math.random() * 300));
    } else if (gameState.phase === 'running') {
      setPlayers(p => p.map(player => ({ ...player, status: 'active' })));
    } else if (gameState.phase === 'crashed') {
      setPlayers(p => p.map(player => player.status === 'active' ? { ...player, status: 'lost' } : player));
    }
  }, [gameState.phase]);

  // Simulate cashouts during running phase
  useEffect(() => {
    if (gameState.phase !== 'running') return;
    
    let rafId: number;
    const loop = () => {
      const currentMult = gameSync.visualMultiplier;
      setPlayers(prev => {
        let changed = false;
        const next = prev.map(p => {
          if (p.status === 'active' && p.cashoutMult && currentMult >= p.cashoutMult) {
            changed = true;
            return { ...p, status: 'cashed' as const, cashoutMult: currentMult };
          }
          return p;
        });
        return changed ? next : prev;
      });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gameState.phase]);

  const activeCount = players.filter(p => p.status === 'active').length;
  const totalStake = players.reduce((sum, p) => sum + p.stake, 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl h-full flex flex-col shadow-2xl overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,240,128,0.8)]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-white/90">Live Bets</h2>
        </div>
        <div className="flex items-center gap-1.5 text-white/40">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs font-bold font-mono">{onlineCount}</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
        <div className="bg-card/40 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Bets</span>
          <span className="font-mono font-bold text-sm text-white/80">{players.length}</span>
        </div>
        <div className="bg-card/40 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Pool</span>
          <span className="font-mono font-bold text-sm text-primary">{formatMoney(totalStake)}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {players.map(player => (
          <div 
            key={player.id}
            className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
              player.status === 'cashed' ? 'bg-primary/5 border-primary/20' :
              player.status === 'lost' ? 'bg-accent/5 border-accent/10 opacity-60' :
              'bg-white/5 border-transparent hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border ${
                player.status === 'cashed' ? 'bg-primary/20 text-primary border-primary/30' :
                player.status === 'lost' ? 'bg-accent/20 text-accent border-accent/30' :
                'bg-black text-white/60 border-white/10'
              }`}>
                {player.avatar}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white/80">{player.username}</span>
                <span className="text-[10px] font-mono text-white/40">{formatMoney(player.stake)}</span>
              </div>
            </div>

            <div className="flex flex-col items-end text-right">
              {player.status === 'cashed' && (
                <>
                  <span className="text-xs font-mono font-bold text-primary">+{formatMoney(player.stake * (player.cashoutMult || 1))}</span>
                  <span className="text-[10px] font-bold text-primary/60">@{formatMultiplier(player.cashoutMult || 1)}</span>
                </>
              )}
              {player.status === 'active' && (
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 animate-pulse">Running</span>
              )}
              {player.status === 'betting' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Pending</span>
              )}
              {player.status === 'lost' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent/60">Crashed</span>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
