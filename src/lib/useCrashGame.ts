import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from './crashSocket';
import { playCrashSound, setCrashSoundsMuted, crashSoundsMuted, startMusic, stopMusic, crashMusicMuted, setCrashMusicMuted } from './crashSounds';
import type { TickData } from './supabaseGameEngine';
import { engine } from './supabaseGameEngine';

export const getSessionId = (panel: 'a' | 'b') => {
  const key = panel === 'a' ? 'crash:sessionIdA' : 'crash:sessionIdB';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
};

export const sessionIdA = getSessionId('a');
export const sessionIdB = getSessionId('b');

export type SingleBetState = 
  | { status: 'idle' }
  | { status: 'pending'; stake: number; autoCashout: number; roundId: string }
  | { status: 'active'; stake: number; autoCashout: number; roundId: string }
  | { status: 'won'; stake: number; payout: number; multiplier: number }
  | { status: 'lost'; stake: number };

export type GameState = {
  phase: 'preparing' | 'running' | 'crashed';
  multiplier: number;
  roundId: string;
  prepSecondsLeft: number | null;
  bettingClosesAt: string | null;
  bettingOpensAt: string | null;
};

export type BetState = {
  a: SingleBetState;
  b: SingleBetState;
};

export const gameSync = {
  serverMultiplier: 1,
  visualMultiplier: 1,
  lastTickMs: performance.now(),
  phase: 'preparing' as GameState['phase']
};

export function useCrashGame() {
  const [balance, setBalanceState] = useState(() => parseFloat(localStorage.getItem('crash:balance') ?? '1000'));
  const [soundsMuted, setSoundsMuted] = useState(crashSoundsMuted());
  const [musicEnabled, setMusicEnabled] = useState(!crashMusicMuted());
  
  const setBalance = useCallback((newBal: number) => {
    setBalanceState(newBal);
    localStorage.setItem('crash:balance', newBal.toString());
  }, []);

  const [gameState, setGameState] = useState<GameState>({
    phase: 'preparing',
    multiplier: 1,
    roundId: '',
    prepSecondsLeft: null,
    bettingClosesAt: null,
    bettingOpensAt: null
  });

  const [betState, setBetState] = useState<BetState>({ a: { status: 'idle' }, b: { status: 'idle' } });
  const [history, setHistory] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  const betStateRef = useRef(betState);
  betStateRef.current = betState;

  useEffect(() => {
    if (musicEnabled) startMusic();
    else stopMusic();
  }, [musicEnabled]);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      socket.emit('session:join', sessionIdA);
      socket.emit('session:join', sessionIdB);
    }
    
    function onDisconnect() {
      setIsConnected(false);
    }
    
    function onTick(data: TickData) {
      gameSync.serverMultiplier = data.multiplier;
      gameSync.phase = data.phase;
      gameSync.lastTickMs = performance.now();
      
      if (data.phase !== 'running') {
        gameSync.visualMultiplier = data.multiplier;
      }
      
      setGameState(prev => {
        const next = { ...prev, ...data, roundId: data.roundId };
        
        if (prev.phase === 'preparing' && next.phase === 'running') {
          playCrashSound('roundStart');
          setBetState(current => {
            const nextBet = { ...current };
            ['a', 'b'].forEach((key) => {
              const k = key as keyof BetState;
              const bet = current[k];
              if (bet.status === 'pending') {
                nextBet[k] = { status: 'active', stake: bet.stake, autoCashout: bet.autoCashout, roundId: next.roundId };
              }
            });
            return nextBet;
          });
        } else if (prev.phase === 'running' && next.phase === 'crashed') {
          playCrashSound('lose');
          setHistory(h => [next.multiplier, ...h].slice(0, 10));
          
          setBetState(current => {
            const nextBet = { ...current };
            ['a', 'b'].forEach((key) => {
              const k = key as keyof BetState;
              const bet = current[k];
              if (bet.status === 'active') {
                nextBet[k] = { status: 'lost', stake: bet.stake };
              }
            });
            return nextBet;
          });
        } else if (prev.phase === 'crashed' && next.phase === 'preparing') {
          setBetState(current => {
            const nextBet = { ...current };
            ['a', 'b'].forEach((key) => {
              const k = key as keyof BetState;
              const bet = current[k];
              if (bet.status === 'won' || bet.status === 'lost') {
                nextBet[k] = { status: 'idle' };
              }
            });
            return nextBet;
          });
        }
        
        return next;
      });
    }

    function onHistory(multipliers: number[]) {
      setHistory(multipliers.slice(0, 10));
    }

    function onAutoCashout(data: { sessionId: string, payout: number, multiplier: number }) {
      const panel = data.sessionId === sessionIdA ? 'a' : data.sessionId === sessionIdB ? 'b' : null;
      if (!panel) return;
      const currentBet = betStateRef.current[panel];
      if (currentBet.status === 'active') {
        setBetState(prev => ({
          ...prev,
          [panel]: { status: 'won', stake: currentBet.stake, payout: data.payout, multiplier: data.multiplier }
        }));
        setBalance(parseFloat(localStorage.getItem('crash:balance') ?? '1000') + data.payout);
        playCrashSound('win');
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game:tick', onTick as (...args: unknown[]) => void);
    socket.on('game:history', onHistory as (...args: unknown[]) => void);
    socket.on('game:autoCashout', onAutoCashout as (...args: unknown[]) => void);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game:tick', onTick as (...args: unknown[]) => void);
      socket.off('game:history', onHistory as (...args: unknown[]) => void);
      socket.off('game:autoCashout', onAutoCashout as (...args: unknown[]) => void);
    };
  }, [setBalance]);

  const placeBet = useCallback((panel: 'a' | 'b', stake: number, autoCashout: number) => {
    if (gameState.phase !== 'preparing' && gameState.phase !== 'running') return;
    const current = betStateRef.current[panel];
    if (current.status !== 'idle' && current.status !== 'won' && current.status !== 'lost') return;
    if (stake > balance) return;
    
    const sessionId = panel === 'a' ? sessionIdA : sessionIdB;
    setBalance(balance - stake);
    
    socket.emit('bet:place', { sessionId, stakeUsd: stake, autoCashout }, (res: unknown) => {
      const r = res as { ok: boolean; roundId?: string };
      if (r?.ok) {
        setBetState(prev => ({ ...prev, [panel]: { status: 'pending', stake, autoCashout, roundId: r.roundId ?? '' } }));
        playCrashSound('bet');
      } else {
        setBalance(parseFloat(localStorage.getItem('crash:balance') ?? '1000') + stake);
      }
    });
  }, [balance, gameState.phase, setBalance]);

  const cancelBet = useCallback((panel: 'a' | 'b') => {
    const current = betStateRef.current[panel];
    if (current.status !== 'pending') return;
    const sessionId = panel === 'a' ? sessionIdA : sessionIdB;
    
    socket.emit('bet:cancel', { sessionId }, (res: unknown) => {
      const r = res as { ok: boolean };
      if (r?.ok) {
        const stake = current.status === 'pending' ? current.stake : 0;
        setBalance(balance + stake);
        setBetState(prev => ({ ...prev, [panel]: { status: 'idle' } }));
        playCrashSound('close');
      }
    });
  }, [balance, setBalance]);

  const cashout = useCallback((panel: 'a' | 'b') => {
    const current = betStateRef.current[panel];
    if (current.status !== 'active') return;
    if (gameState.phase !== 'running') return;
    const sessionId = panel === 'a' ? sessionIdA : sessionIdB;

    socket.emit('bet:cashout', { sessionId }, (res: unknown) => {
      const r = res as { ok: boolean; payout?: number; multiplier?: number };
      if (r?.ok) {
        setBetState(prev => ({ ...prev, [panel]: { status: 'won', stake: (current as { stake: number }).stake, payout: r.payout ?? 0, multiplier: r.multiplier ?? 1 } }));
        setBalance(parseFloat(localStorage.getItem('crash:balance') ?? '1000') + (r.payout ?? 0));
        playCrashSound('win');
      }
    });
  }, [gameState.phase, setBalance]);

  const toggleSounds = useCallback(() => {
    const next = !crashSoundsMuted();
    setCrashSoundsMuted(next);
    setSoundsMuted(next);
    if (!next) playCrashSound('tickSoft');
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !musicEnabled;
    setMusicEnabled(next);
    setCrashMusicMuted(!next);
  }, [musicEnabled]);

  return {
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
    toggleMusic
  };
}
