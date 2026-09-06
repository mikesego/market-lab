import Decimal from "decimal.js";
import { applyClassroomTrade, type ClassroomState, type ClassroomTrade, type PricePack } from "./model";

const DATABASE = "market-lab-classroom-v1";
export function openClassroomStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("device");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("This browser cannot save classroom work. Enable website storage and use a regular, non-private tab."));
    request.onblocked = () => reject(new Error("Close other Market Lab tabs, then try again."));
  });
}

// A single IDB read/write transaction serializes tabs and service workers.
// No network awaits inside it. Success is reported ONLY after durable commit.
export async function changeStore<T>(key: string, change: (value: T | undefined) => T | undefined): Promise<T | undefined> {
  const database = await openClassroomStore();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("device", "readwrite");
    const store = tx.objectStore("device");
    const request = store.get(key);
    let result: T | undefined;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        result = change(request.result as T | undefined);
        if (result === undefined) store.delete(key); else store.put(result, key);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { database.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { database.close(); reject(failure ?? new Error("Could not save your work on this tablet. The trade was not completed. Free storage and try again.")); };
  });
}

export async function readStore<T>(key: string): Promise<T | undefined> {
  const database = await openClassroomStore();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("device", "readonly");
    const request = tx.objectStore("device").get(key);
    tx.oncomplete = () => { database.close(); resolve(request.result as T | undefined); };
    tx.onabort = tx.onerror = () => { database.close(); reject(new Error("Could not read saved classroom work.")); };
  });
}
export const readState = () => readStore<ClassroomState>("state");
export const changeState = (change: (value: ClassroomState | undefined) => ClassroomState | undefined) => changeStore("state", change);

export function randomId() {
  // randomUUID is absent in older Silk; getRandomValues is widely available.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function saveTrade(input: Pick<ClassroomTrade, "symbol" | "side" | "quantity" | "rationale" | "confidence">, displayedPackId: string) {
  return changeState((state) => {
    if (!state) throw new Error("Prepare this device first.");
    if (state.releasing) throw new Error("This device is being released. Finish releasing it before preparing another student.");
    if (state.syncError) throw new Error("Resolve the sync issue before making another trade. Your saved trades are safe.");
    if (state.pack.id !== displayedPackId) throw new Error("Prices just refreshed. Review the new price, then submit again.");
    const trade: ClassroomTrade = { ...input, quantity: new Decimal(input.quantity).toFixed(), id: randomId(), sequence: state.lastSequence + 1, packId: state.pack.id, executedAt: new Date().toISOString() };
    const result = applyClassroomTrade(state.account, state.pack, trade);
    return { ...state, account: result.account, lastSequence: trade.sequence, trades: [...state.trades, result.receipt] };
  });
}

export function installPack(state: ClassroomState, pack: PricePack): ClassroomState {
  if (pack.deviceId !== state.deviceId) throw new Error("These prices belong to a different device.");
  // Older overlapping refresh responses cannot move the latest-known price back.
  if (Date.parse(pack.fetchedAt) < Date.parse(state.pack.fetchedAt)) return state;
  return { ...state, pack, packs: { ...state.packs, [pack.id]: pack }, pricesError: null };
}
