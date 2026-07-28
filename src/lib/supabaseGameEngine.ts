// Supabase-backed crash game engine
// Server-authoritative: all game state comes from Supabase Edge Functions
// Provably fair: crash point = HMAC-SHA256(server_seed, round_id)
// All users share the same round - no client-side RNG

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[CrashGame] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type Listener = (...args: unknown[]) => void;
type Phase = 'preparing' | 'running' | 'crashed';

interface GameStateRow {
  phase: Phase;
  multiplier: number;
  prep_seconds_left: number | null;
  betting_closes_at: string | null;
  betting_opens_at: string | null;
  round_id: string | null;
  current_round_id: string | null;
  updated_at: string;
}

export interface TickData {
  phase: Phase;
  multiplier: number;
  roundId: string;
  prepSecondsLeft: number | null;
  bettingClosesAt: string | null;
  bettingOpensAt: string | null;
}

class SupabaseGameEngine {
  connected = false;
  private listeners: Record<string, Listener[]> = {};
  private realtimeChannel: RealtimeChannel | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastRoundId: string | null = null;
  private lastPhase: Phase = 'preparing';
  private runningStartTime: number | null = null;
  private serverMultiplierAtSync: number = 1;
  private rafId: number = 0;
  // Tracks whether we've already poked the engine for this transition
  private pokedForRound: string | null = null;

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  private emit(event: string, ...args: unknown[]) {
    (this.listeners[event] || []).forEach((l) => l(...args));
  }

  async socketEmit(
    event: string,
    payload: unknown,
    callback?: (res: unknown) => void
  ) {
    if (event === 'session:join') return;

    if (event === 'bet:place') {
      const { sessionId, stakeUsd, autoCashout } = payload as {
        sessionId: string;
        stakeUsd: number;
        autoCashout: number;
      };
      try {
        const res = await fetch(`${FUNCTIONS_URL}/place-bet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ sessionId, stakeUsd, autoCashout }),
        });
        const data = await res.json() as { ok: boolean; roundId?: string; error?: string };
        if (callback) callback(data);
      } catch (err) {
        console.error('[CrashGame] place-bet error:', err);
        if (callback) callback({ ok: false });
      }
      return;
    }

    if (event === 'bet:cancel') {
      const { sessionId } = payload as { sessionId: string };
      try {
        const res = await fetch(`${FUNCTIONS_URL}/cancel-bet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json() as { ok: boolean };
        if (callback) callback(data);
      } catch {
        if (callback) callback({ ok: false });
      }
      return;
    }

    if (event === 'bet:cashout') {
      const { sessionId } = payload as { sessionId: string };
      try {
        const res = await fetch(`${FUNCTIONS_URL}/cashout-bet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json() as { ok: boolean; payout?: number; multiplier?: number; roundId?: string };
        if (callback) callback(data);
      } catch {
        if (callback) callback({ ok: false });
      }
      return;
    }
  }

  private applyState(row: GameStateRow) {
    const roundId = row.round_id ?? row.current_round_id ?? '';
    const phase = row.phase;
    const multiplier = parseFloat(String(row.multiplier ?? 1));

    if (phase === 'running' && this.lastPhase !== 'running') {
      this.runningStartTime = performance.now();
      this.serverMultiplierAtSync = multiplier;
    } else if (phase !== 'running') {
      this.runningStartTime = null;
    }

    this.lastPhase = phase;
    this.lastRoundId = roundId;

    const tick: TickData = {
      phase,
      multiplier,
      roundId,
      prepSecondsLeft: row.prep_seconds_left !== null ? parseFloat(String(row.prep_seconds_left)) : null,
      bettingClosesAt: row.betting_closes_at,
      bettingOpensAt: row.betting_opens_at,
    };

    this.emit('game:tick', tick);

    // KEY FIX: if betting window just expired but backend hasn't transitioned yet,
    // poke the game-engine immediately so we don't wait up to 15s for next cron
    if (phase === 'preparing' && row.betting_closes_at) {
      const closesAt = new Date(row.betting_closes_at).getTime();
      const now = Date.now();
      if (now >= closesAt && this.pokedForRound !== roundId) {
        this.pokedForRound = roundId;
        // Small delay to avoid race with cron that might be running concurrently
        setTimeout(() => {
          fetch(`${FUNCTIONS_URL}/game-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
            body: '{}',
          }).catch(() => {});
        }, 300);
      }
    }

    // KEY FIX: if crashed and betting_opens_at has passed, poke engine to reset
    if (phase === 'crashed' && row.betting_opens_at) {
      const opensAt = new Date(row.betting_opens_at).getTime();
      const now = Date.now();
      const pokeKey = `crashed-${row.current_round_id ?? roundId}`;
      if (now >= opensAt && this.pokedForRound !== pokeKey) {
        this.pokedForRound = pokeKey;
        setTimeout(() => {
          fetch(`${FUNCTIONS_URL}/game-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
            body: '{}',
          }).catch(() => {});
        }, 300);
      }
    }
  }

  private startInterpolation() {
    const loop = () => {
      if (this.lastPhase === 'running' && this.runningStartTime !== null) {
        const elapsed = (performance.now() - this.runningStartTime) / 1000;
        const interpolated = parseFloat(
          (this.serverMultiplierAtSync * Math.exp(elapsed * 0.15)).toFixed(2)
        );
        const tick: TickData = {
          phase: 'running',
          multiplier: interpolated,
          roundId: this.lastRoundId ?? '',
          prepSecondsLeft: null,
          bettingClosesAt: null,
          bettingOpensAt: null,
        };
        this.emit('game:tick', tick);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  async start() {
    // 1. Realtime subscription for instant phase transitions
    this.realtimeChannel = supabase
      .channel('game_state_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.current' },
        (payload) => {
          this.applyState(payload.new as GameStateRow);
          if ((payload.new as GameStateRow).phase === 'running') {
            this.runningStartTime = performance.now();
            this.serverMultiplierAtSync = parseFloat(String((payload.new as GameStateRow).multiplier ?? 1));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.connected = true;
          this.emit('connect');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.connected = false;
          this.emit('disconnect');
        }
      });

    // 2. Poll game-state every 1s
    await this.fetchAndEmitState();
    this.pollTimer = setInterval(() => this.fetchAndEmitState(), 1000);

    // 3. Start interpolation loop
    this.startInterpolation();
  }

  private async fetchAndEmitState() {
    try {
      const res = await fetch(`${FUNCTIONS_URL}/game-state`, {
        headers: { 'apikey': SUPABASE_ANON_KEY },
      });
      if (!res.ok) return;
      const data = await res.json() as {
        state: GameStateRow;
        history: Array<{ crash_point: number; server_seed_hash: string; server_seed?: string; round_number: number }>;
        sessionBets: Array<unknown>;
      };

      if (data.state) {
        if (data.state.phase === 'running') {
          this.runningStartTime = performance.now();
          this.serverMultiplierAtSync = parseFloat(String(data.state.multiplier ?? 1));
        }
        this.applyState(data.state);
      }

      if (data.history && data.history.length > 0) {
        const historyMultipliers = data.history.map((r) => parseFloat(String(r.crash_point)));
        this.emit('game:history', historyMultipliers);
      }
    } catch (err) {
      console.warn('[CrashGame] State poll error:', err);
    }
  }

  stop() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.connected = false;
  }
}

export const engine = new SupabaseGameEngine();
