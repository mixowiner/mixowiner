import { playCrashSound } from './crashSounds';

type TickData = {
  phase: 'preparing' | 'running' | 'crashed';
  multiplier: number;
  roundId: string;
  prepSecondsLeft: number | null;
  bettingClosesAt: string | null;
  bettingOpensAt: string | null;
};

type Listener = (...args: any[]) => void;

const PREP_SECONDS = 5;

function generateCrashPoint() {
  // house edge ~ 1% average crash around 1.97x
  const r = Math.random();
  const m = 0.99 / (1 - r);
  return Math.max(1.01, Math.min(1000, m));
}

class LocalEngine {
  connected = true;
  private listeners: Record<string, Listener[]> = {};
  private phase: 'preparing' | 'running' | 'crashed' = 'preparing';
  private roundId = crypto.randomUUID();
  private prepSecondsLeft = PREP_SECONDS;
  private multiplier = 1;
  private crashPoint = generateCrashPoint();
  private startTime = 0;
  private rafId = 0;
  private bets = new Map<string, { stake: number; autoCashout: number }>();
  private nextBets = new Map<string, { stake: number; autoCashout: number }>();
  private cashedOut = new Set<string>();
  private resetTimeout = 0;

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  private internalEmit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach((l) => l(...args));
  }

  emit(event: string, ...args: any[]) {
    if (event === 'session:join') return;
    if (event === 'bet:place') {
      const { sessionId, stakeUsd, autoCashout } = args[0];
      const cb = args[args.length - 1];
      if (this.phase === 'preparing') {
        this.bets.set(sessionId, { stake: stakeUsd, autoCashout });
      } else if (this.phase === 'running') {
        this.nextBets.set(sessionId, { stake: stakeUsd, autoCashout });
      } else {
        if (typeof cb === 'function') cb({ ok: false });
        return;
      }
      if (typeof cb === 'function') cb({ ok: true, roundId: this.roundId });
      return;
    }
    if (event === 'bet:cancel') {
      const { sessionId } = args[0];
      const cb = args[args.length - 1];
      const removed = this.bets.delete(sessionId) || this.nextBets.delete(sessionId);
      if (typeof cb === 'function') cb({ ok: removed });
      return;
    }
    if (event === 'bet:cashout') {
      const { sessionId } = args[0];
      const cb = args[args.length - 1];
      if (this.phase === 'running' && this.bets.has(sessionId) && !this.cashedOut.has(sessionId)) {
        this.cashout(sessionId);
        if (typeof cb === 'function') cb({ ok: true, payout: this.bets.get(sessionId)!.stake * this.multiplier, multiplier: this.multiplier });
      } else {
        if (typeof cb === 'function') cb({ ok: false });
      }
      return;
    }
    // inbound events emitted by the engine itself
    this.internalEmit(event, ...args);
  }

  private tick() {
    if (this.phase === 'preparing') {
      this.prepSecondsLeft -= 0.05;
      if (this.prepSecondsLeft <= 0) {
        this.phase = 'running';
        this.startTime = performance.now();
        this.multiplier = 1;
        playCrashSound('roundStart');
      }
    } else if (this.phase === 'running') {
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.multiplier = Math.exp(elapsed * 0.15);
      // check auto cashouts
      this.bets.forEach((bet, sessionId) => {
        if (!this.cashedOut.has(sessionId) && this.multiplier >= bet.autoCashout) {
          this.cashout(sessionId);
        }
      });
      if (this.multiplier >= this.crashPoint) {
        this.phase = 'crashed';
        this.multiplier = this.crashPoint;
        playCrashSound('lose');
      }
    } else if (this.phase === 'crashed') {
      if (!this.resetTimeout) {
        this.resetTimeout = window.setTimeout(() => {
          this.resetTimeout = 0;
          this.resetRound();
        }, 2500);
      }
      this.sendTick();
      this.rafId = requestAnimationFrame(() => this.tick());
      return;
    }

    this.sendTick();
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  private sendTick() {
    const data: TickData = {
      phase: this.phase,
      multiplier: Number(this.multiplier.toFixed(2)),
      roundId: this.roundId,
      prepSecondsLeft: this.phase === 'preparing' ? Math.max(0, Math.ceil(this.prepSecondsLeft)) : null,
      bettingClosesAt: this.phase === 'preparing' ? new Date(Date.now() + this.prepSecondsLeft * 1000).toISOString() : null,
      bettingOpensAt: this.phase === 'crashed' ? new Date(Date.now() + 2500).toISOString() : null,
    };
    this.internalEmit('game:tick', data);
  }

  private cashout(sessionId: string) {
    if (!this.bets.has(sessionId) || this.cashedOut.has(sessionId)) return;
    this.cashedOut.add(sessionId);
    const payout = this.bets.get(sessionId)!.stake * this.multiplier;
    this.internalEmit('game:autoCashout', { sessionId, payout, multiplier: this.multiplier });
  }

  private resetRound() {
    this.phase = 'preparing';
    this.roundId = crypto.randomUUID();
    this.prepSecondsLeft = PREP_SECONDS;
    this.multiplier = 1;
    this.crashPoint = generateCrashPoint();
    this.bets = this.nextBets;
    this.nextBets = new Map<string, { stake: number; autoCashout: number }>();
    this.cashedOut.clear();
  }

  start() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => this.tick());
  }
}

export const socket = new LocalEngine();
socket.start();
