// Socket adapter: bridges existing socket.on/off/emit API to Supabase engine
// Keeps all existing game hook code working without changes
import { engine } from './supabaseGameEngine';

type Listener = (...args: unknown[]) => void;

class SocketAdapter {
  get connected() {
    return engine.connected;
  }

  on(event: string, listener: Listener) {
    engine.on(event, listener);
  }

  off(event: string, listener: Listener) {
    engine.off(event, listener);
  }

  // Handles bet:place, bet:cancel, bet:cashout, session:join
  emit(event: string, ...args: unknown[]) {
    const last = args[args.length - 1];
    const callback = typeof last === 'function' ? (last as (res: unknown) => void) : undefined;
    const payload = callback ? args[0] : args[0];
    engine.socketEmit(event, payload, callback).catch(console.error);
  }
}

export const socket = new SocketAdapter();

// Auto-start engine when module loads
engine.start().catch(console.error);
