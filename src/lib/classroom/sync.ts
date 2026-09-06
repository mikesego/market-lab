import type { ClassroomAccount, ClassroomState, PricePack } from "./model";
import { changeState, changeStore, installPack, randomId, readState } from "./store";

export class SyncFailure extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function classroomRequest<T>(path: string, body: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`/api/classroom/${path}`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: controller.signal });
    const result = await response.json();
    if (!response.ok) throw new SyncFailure(result.error ?? "Could not connect to Market Lab.", response.status);
    return result as T;
  } finally { clearTimeout(timer); }
}

export async function syncClassroom(options: { refresh?: boolean; symbols?: string[] } = {}) {
  const owner = randomId();
  const lease = await changeStore<{ owner: string; until: number }>("syncLease", (old) => old && old.until > Date.now() ? old : { owner, until: Date.now() + 90_000 });
  if (lease?.owner !== owner) return readState();
  try {
    let state = await readState();
    if (!state) return;
    // Each batch is atomic and retryable. Keep a bounded worker lifetime.
    let adjustmentsPending = false;
    let refreshRequestedAt: string | null = null;
    for (let batch = 0; batch < 10; batch++) {
      const upload = state.trades.filter((t) => t.sequence > state!.acknowledgedSequence).slice(0, 100);
      const result = await classroomRequest<{ acknowledgedSequence: number; syncedAt: string; refreshRequestedAt: string | null; adjustmentsPending?: boolean }>("sync", { deviceId: state.deviceId, trades: upload }, state.token);
      refreshRequestedAt = result.refreshRequestedAt;
      adjustmentsPending ||= result.adjustmentsPending === true;
      const deviceId = state.deviceId;
      state = await changeState((current) => {
        if (!current || current.deviceId !== deviceId) throw new Error("The assigned device changed during sync.");
        if (!Number.isInteger(result.acknowledgedSequence) || result.acknowledgedSequence > current.lastSequence) throw new SyncFailure("This backup is older than the server’s trade history. Keep it and ask your teacher to restore the latest tablet backup.", 409);
        const acknowledgedSequence = Math.max(current.acknowledgedSequence, result.acknowledgedSequence);
        const needed = new Set([current.pack.id, ...current.trades.filter((t) => t.sequence > acknowledgedSequence).map((t) => t.packId)]);
        return { ...current, acknowledgedSequence, lastSyncAt: result.syncedAt, syncError: current.reconciling || current.releasing ? current.syncError : null, packs: Object.fromEntries(Object.entries(current.packs).filter(([id]) => needed.has(id))) };
      });
      if (!state || state.lastSequence === state.acknowledgedSequence) break;
      await changeStore<{ owner: string; until: number }>("syncLease", (old) => old?.owner === owner ? { owner, until: Date.now() + 90_000 } : old);
    }
    if (state && (adjustmentsPending || state.reconciling)) {
      state = await changeState((current) => current ? { ...current, reconciling: true, syncError: "Updating holdings for a stock split or dividend. Reconnect to finish; saved trades are safe." } : current);
      if (state && state.lastSequence === state.acknowledgedSequence) {
        const result = await classroomRequest<{ account: ClassroomAccount; pack: PricePack }>("reconcile", { deviceId: state.deviceId, lastSequence: state.lastSequence }, state.token);
        state = await changeState((current) => {
          if (!current || current.lastSequence !== current.acknowledgedSequence || !current.reconciling) throw new SyncFailure("Finish backing up trades before updating holdings.", 409);
          return { ...installPack(current, result.pack), account: result.account, reconciling: false, syncError: null };
        });
      }
    }
    if (state && !state.reconciling && (options.refresh || (refreshRequestedAt && Date.parse(refreshRequestedAt) > Date.parse(state.pack.fetchedAt)))) {
      try {
        const pack = await classroomRequest<PricePack>("prices", { deviceId: state.deviceId, symbols: options.symbols ?? [] }, state.token);
        state = await changeState((current) => current ? installPack(current, pack) : current);
      } catch (error) {
        const message = error instanceof SyncFailure ? error.message : "Prices could not refresh. Trading continues at your saved prices.";
        state = await changeState((current) => current ? { ...current, pricesError: message } : current);
        // A provider outage must never turn a successful trade backup into a
        // false failure, or disable trading with the last known price.
      }
    }
    return state;
  } catch (error) {
    if (error instanceof SyncFailure && error.status >= 400 && error.status < 500 && error.status !== 429) {
      await changeState((state) => state ? { ...state, syncError: error.message } : state);
    }
    throw error;
  } finally {
    await changeStore<{ owner: string; until: number }>("syncLease", (old) => old?.owner === owner ? undefined : old);
  }
}

export type SetupIdentity = { deviceId: string; token: string; label: string };
export async function prepareDevice(label: string) {
  const identity = await changeStore<SetupIdentity>("setup", (old) => old ?? { deviceId: randomId(), token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join(""), label });
  const state = await classroomRequest<ClassroomState>("setup", identity);
  return changeState((current) => {
    if (current) throw new Error("This browser already has a saved classroom portfolio.");
    return state;
  });
}
