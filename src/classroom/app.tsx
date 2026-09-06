import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Decimal from "decimal.js";
import { parseClassroomBackup } from "../lib/classroom/backup";
import { accountEquity, type ClassroomState } from "../lib/classroom/model";
import { changeState, changeStore, readState, saveTrade } from "../lib/classroom/store";
import { classroomRequest, prepareDevice, syncClassroom } from "../lib/classroom/sync";

const money = (value: string | number | Decimal) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
const time = (value?: string | null) => value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not yet";
const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Your saved work has been kept.";
type BackgroundRegistration = ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> }; periodicSync?: { register(tag: string, options: { minInterval: number }): Promise<void> } };
async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/classroom") as BackgroundRegistration | undefined;
  try { await registration?.sync?.register("market-lab-trades"); } catch { /* Foreground retry remains available. */ }
}
async function checkOfflineReady() {
  if (!isSecureContext || !("serviceWorker" in navigator) || !("indexedDB" in window) || !("caches" in window)) throw new Error("This browser cannot run Market Lab offline. Update Fire OS and Silk, then try again in a regular tab.");
  const existing = await navigator.serviceWorker.getRegistration("/classroom");
  if (!existing) await navigator.serviceWorker.register("/classroom/sw.js", { scope: "/classroom", updateViaCache: "none" });
  else if (navigator.onLine) void existing.update().catch(() => {});
  const registration = await new Promise<BackgroundRegistration>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("The offline download has not finished. Reconnect to good Wi-Fi and reload.")), 20_000);
    navigator.serviceWorker.ready.then((value) => { clearTimeout(timeout); resolve(value as BackgroundRegistration); }, (error) => { clearTimeout(timeout); reject(error); });
  });
  const ready = await new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); resolve(false); }, 10_000);
    channel.port1.onmessage = (event) => { clearTimeout(timeout); channel.port1.close(); resolve(event.data?.ready === true); };
    registration.active?.postMessage({ type: "CHECK_READY" }, [channel.port2]);
  });
  if (!ready) throw new Error("The offline app download is incomplete. Reconnect to good Wi-Fi and reload before class.");
  try { await registration.periodicSync?.register("market-lab-prices", { minInterval: 15 * 60_000 }); } catch { /* Not supported or not installed. */ }
  return true;
}

function App() {
  const [state, setState] = useState<ClassroomState>();
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState("Portfolio");
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [wake, setWake] = useState(false);
  const running = useRef(false);
  const refreshAt = useRef(0);

  async function connect(refresh = true, symbols?: string[]) {
    if (running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      const updated = await syncClassroom({ refresh, symbols });
      if (updated) { setState(updated); setConnected(true); if (refresh) refreshAt.current = Date.now(); }
    } catch {
      setConnected(false);
      const saved = await readState().catch(() => undefined);
      if (saved) setState(saved);
      await requestBackgroundSync();
    } finally { running.current = false; setSyncing(false); }
  }
  useEffect(() => {
    let mounted = true;
    readState().then((saved) => { if (mounted) { setState(saved); setLoaded(true); if (saved) void connect(true); } }).catch((e) => { setLoaded(true); setError(message(e)); });
    checkOfflineReady().then(() => { if (mounted) setReady(true); }).catch((e) => { if (mounted) setError(message(e)); });
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    const online = () => { setConnected(true); void connect(true); };
    const offline = () => { setConnected(false); void requestBackgroundSync(); };
    const focus = () => { if (document.visibilityState === "visible") { void readState().then(setState); void connect(Date.now() - refreshAt.current >= 60_000); } };
    const interval = setInterval(() => {
      void readState().then((saved) => { if (mounted) setState(saved); });
      // Attempt even when navigator.onLine lies (captive portal, bad Wi-Fi).
      if (document.visibilityState === "visible") void connect(Date.now() - refreshAt.current >= 60_000);
    }, 20_000 + Math.round(Math.random() * 5_000));
    addEventListener("online", online); addEventListener("offline", offline);
    document.addEventListener("visibilitychange", focus);
    navigator.serviceWorker?.addEventListener("message", focus);
    return () => { mounted = false; clearInterval(interval); removeEventListener("online", online); removeEventListener("offline", offline); document.removeEventListener("visibilitychange", focus); navigator.serviceWorker?.removeEventListener("message", focus); };
  }, []);

  useEffect(() => {
    if (!wake) return;
    let sentinel: { release(): Promise<void> } | undefined;
    const request = async () => {
      try {
        const api = (navigator as Navigator & { wakeLock?: { request(type: string): Promise<{ release(): Promise<void> }> } }).wakeLock;
        if (!api) { setNotice("Silk does not offer screen wake lock. Increase Display Sleep in Fire Settings while the tablets are charging."); setWake(false); return; }
        sentinel = await api.request("screen");
      } catch { setNotice("Keep the tablet charging and Market Lab visible. Your tablet may still put the screen to sleep."); }
    };
    void request();
    const focus = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", focus);
    return () => { void sentinel?.release(); document.removeEventListener("visibilitychange", focus); };
  }, [wake]);

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const label = String(new FormData(event.currentTarget).get("label"));
    try {
      if (!ready) throw new Error("Wait for the offline app download to finish, or reload on good Wi-Fi.");
      const saved = await prepareDevice(label);
      setState(saved);
      if (navigator.storage?.persist) setPersisted(await navigator.storage.persist());
      setNotice("Device prepared. Turn Wi-Fi off and reload this page to check it before class.");
      await connect(true);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function trade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !state) return;
    setBusy(true); setError(""); setNotice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const updated = await saveTrade({ symbol, side, quantity, rationale: String(data.get("rationale") ?? "").trim(), confidence: Number(data.get("confidence") ?? 3) }, state.pack.id);
      setState(updated);
      const receipt = updated!.trades[updated!.trades.length - 1];
      setNotice(`${side === "buy" ? "Bought" : "Sold"} ${quantity} ${symbol} at ${money(receipt.price)} per share. Completed and saved on this tablet.`);
      setTab("History");
      await requestBackgroundSync();
      // Trading does not wait for any network request or provider response.
      void connect(false);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function restoreBackup(file?: File) {
    if (!file) return;
    setError(""); setBusy(true);
    try {
      if (file.size > 10_000_000) throw new Error("This backup is too large. Ask your teacher for help.");
      const restored = parseClassroomBackup(JSON.parse(await file.text()));
      if (!confirm(`Restore ${restored.studentName} on ${restored.label}? Keep the original tablet closed while using this restored copy.`)) return;
      await changeState((current) => { if (current) throw new Error("Sync and release this browser’s current student before restoring another."); return restored; });
      setState(restored); setNotice("Backup restored. Reconnect to verify and back up any pending trades. Keep the original tablet closed.");
      void connect(true);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function exportBackup() {
    try {
      const saved = await readState();
      if (!saved) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(saved)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `market-lab-${saved.label.replace(/[^a-z0-9-]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotice("Backup downloaded. Keep it private: it contains this student’s work and device access key.");
    } catch (e) { setError(message(e)); }
  }
  async function release() {
    if (!state || state.lastSequence !== state.acknowledgedSequence) { setError("Back up all trades before releasing this device."); return; }
    if (!confirm(`Release ${state.label} for ${state.studentName}? Its synced work stays in the teacher workspace. This removes the classroom copy from this browser.`)) return;
    setBusy(true);
    try {
      const locked = await changeState((current) => {
        if (!current || current.lastSequence !== current.acknowledgedSequence) throw new Error("A new trade needs to sync first.");
        return { ...current, releasing: true, syncError: "Releasing device. Reconnect and retry Release if interrupted." };
      });
      await classroomRequest("release", { deviceId: locked!.deviceId, lastSequence: locked!.lastSequence }, locked!.token);
      await changeState(() => undefined); await changeStore("setup", () => undefined); setState(undefined); setNotice("Device released. Sign in as the next student before preparing it again.");
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  const asset = state?.pack.assets[symbol];
  const pending = state ? state.lastSequence - state.acknowledgedSequence : 0;
  const equity = state ? accountEquity(state.account, state.pack) : new Decimal(0);
  const investments = state ? Object.values(state.pack.assets).filter((a) => `${a.symbol} ${a.name} ${a.sector}`.toLowerCase().includes(search.toLowerCase())) : [];
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="masthead"><a className="brand" href="/classroom"><span aria-hidden="true">▥</span> Market Lab <small>CLASSROOM</small></a><span className="simulated">Practice money. Real learning.</span></header>
    <main id="main">
      <div className="page-heading"><div><p className="eyebrow">{state ? `${state.gameName} · ${state.label}` : "Made for learning, wherever you are"}</p><h1>{state ? `${state.studentName}’s market lab` : "Your classroom, ready to go."}</h1><p>Buy and sell instantly at your latest saved price. Online or offline.</p></div>{state && <button className="secondary" onClick={() => void connect(true)} disabled={syncing}>{syncing ? "Connecting…" : "Sync & refresh now"}</button>}</div>
      {error && <div role="alert" className="alert"><strong>Needs attention</strong><p>{error}</p><button className="quiet" onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {!loaded ? <p>Reading saved work…</p> : !state ? <section className="card setup"><p className="eyebrow">One-time setup · On good Wi-Fi</p><h2>Prepare this tablet</h2><ol><li><a href="/join">Sign in as the student assigned to this tablet.</a></li><li>Return to this page and give the tablet a label, such as Fire 01.</li><li>Prepare it, then turn Wi-Fi off and reload to test it.</li></ol><p>{ready ? "✓ App downloaded for offline use" : "Downloading the offline app…"}</p><form onSubmit={prepare}><label htmlFor="label">Tablet label</label><input id="label" name="label" placeholder="Fire 01" maxLength={40} required /><button disabled={busy || !ready}>{busy ? "Preparing portfolio & prices…" : "Prepare this device"}</button></form><hr /><label htmlFor="restore-backup">Restore a teacher-held backup</label><input id="restore-backup" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => void restoreBackup(event.target.files?.[0])} /><p className="muted">Use a regular Silk tab. Keep one student assigned to each tablet. Preparing requires a connection; trading afterward does not.</p></section> : <>
        <section className="connection" aria-label="Device status"><div><strong>{connected ? "Connected" : "Offline / connection unavailable"}</strong><span>{connected ? "Prices refresh automatically about every minute." : "Trades still complete now at your saved prices."}</span></div><div><strong>{pending ? `${pending} trade${pending === 1 ? "" : "s"} saved on tablet` : "All trades backed up"}</strong><span>{pending ? "Backup will happen automatically on reconnect." : `Last check-in: ${time(state.lastSyncAt)}`}</span></div><div><strong>{ready ? "Ready for offline use" : "Offline app needs checking"}</strong><span>Price download: {time(state.pack.fetchedAt)}</span></div></section>
        {state.syncError && <div className="alert" role="alert"><strong>Sync needs your teacher’s help</strong><p>{state.syncError}</p><button className="secondary" onClick={exportBackup}>Download backup</button><p>Your existing trades remain saved. New trades are paused until this is resolved.</p></div>}
        {state.pricesError && <p className="notice">{state.pricesError} Each investment shows its saved price and source time.</p>}
        <nav className="tabs" aria-label="Classroom workspace">{["Portfolio", "Discover & trade", "History", "Learn", "Device & help"].map((name) => <button key={name} className={name === tab ? "active" : ""} aria-current={name === tab ? "page" : undefined} onClick={() => { setTab(name); setError(""); }}>{name}</button>)}</nav>
        {tab === "Portfolio" && <><section className="metrics"><article className="metric hero-metric"><span>Total portfolio</span><strong data-testid="equity">{money(equity)}</strong><small>Valued at this tablet’s latest saved prices</small></article><article className="metric"><span>Cash to invest</span><strong data-testid="cash">{money(state.account.cash)}</strong><small>Available immediately</small></article><article className="metric"><span>Return since start</span><strong>{equity.minus(state.startingCash).div(state.startingCash).times(100).toFixed(2)}%</strong><small>Starting practice cash: {money(state.startingCash)}</small></article></section><section className="card"><h2>Your investments</h2>{Object.entries(state.account.positions).filter(([, p]) => Number(p.quantity) > 0).length === 0 ? <p>No investments yet. Discover a company or fund to make your first trade.</p> : <div className="table-wrap"><table><thead><tr><th>Investment</th><th>Shares</th><th>Saved price</th><th>Value</th><th>Action</th></tr></thead><tbody>{Object.entries(state.account.positions).filter(([, p]) => Number(p.quantity) > 0).map(([heldSymbol, p]) => <tr key={heldSymbol}><td><strong>{heldSymbol}</strong><small>{state.pack.assets[heldSymbol]?.name}</small></td><td data-testid={`shares-${heldSymbol}`}>{Number(p.quantity)}</td><td>{money(state.pack.assets[heldSymbol].price)}<small>{time(state.pack.assets[heldSymbol].asOf)}</small></td><td>{money(new Decimal(p.quantity).times(state.pack.assets[heldSymbol].price))}</td><td><button className="secondary" onClick={() => { setSymbol(heldSymbol); setTab("Discover & trade"); }}>Trade {heldSymbol}</button></td></tr>)}</tbody></table></div>}</section></>}
        {tab === "Discover & trade" && <div className="trade-layout"><section><div className="card"><h2>Explore your saved investments</h2><label htmlFor="search">Search downloaded investments</label><input id="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, symbol, or sector" /><div className="investment-list">{investments.map((a) => <button className={symbol === a.symbol ? "investment selected" : "investment"} key={a.symbol} onClick={() => setSymbol(a.symbol)}><span><strong>{a.symbol}</strong><small>{a.name} · {a.assetType.toUpperCase()}</small></span><span>{money(a.price)}<small>{time(a.asOf)}</small></span></button>)}</div><p className="muted">Only downloaded investments are available offline. Add more while connected.</p><form className="inline" onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("symbol")).trim().toUpperCase(); void connect(true, [value]); }}><label htmlFor="new-symbol">Download another symbol</label><input id="new-symbol" name="symbol" placeholder="e.g. SBUX" pattern="[A-Za-z0-9][A-Za-z0-9.-]{0,14}" required maxLength={15} /><button className="secondary" disabled={syncing}>Download</button></form></div></section>{asset && <section className="card ticket"><p className="eyebrow">{asset.sector}</p><h2>{asset.name} <small>{symbol}</small></h2><p>{asset.description}</p><div className="price"><strong>{money(asset.price)}</strong><span>per share · Saved price as of {time(asset.asOf)}</span><small>Exact execution price: ${asset.price}</small></div><form onSubmit={trade}><fieldset className="side"><legend>Trade direction</legend>{(["buy", "sell"] as const).map((direction) => <label key={direction}><input type="radio" name="side" value={direction} checked={side === direction} onChange={() => setSide(direction)} />{direction === "buy" ? "Buy" : "Sell"}</label>)}</fieldset><label htmlFor="quantity">Shares</label><input id="quantity" type="number" inputMode="decimal" min={state.pack.rules.allowFractional && asset.fractionable ? "0.000001" : "1"} step={state.pack.rules.allowFractional && asset.fractionable ? "0.000001" : "1"} value={quantity} onChange={(e) => setQuantity(e.target.value)} required /><p>Owned: <strong>{Number(state.account.positions[symbol]?.quantity ?? 0)} shares</strong> · Cash: <strong>{money(state.account.cash)}</strong></p><label htmlFor="rationale">Why does this decision make sense?{state.pack.rules.rationaleRequired ? "" : " (optional)"}</label><textarea id="rationale" name="rationale" rows={3} minLength={state.pack.rules.rationaleRequired ? 20 : undefined} maxLength={600} required={state.pack.rules.rationaleRequired} placeholder="I expect… because… One risk is…" /><label htmlFor="confidence">Confidence (1 = unsure, 5 = very confident)</label><input id="confidence" name="confidence" type="range" min="1" max="5" defaultValue="3" /><div className="total"><span>Total at saved price</span><strong>{money((Number(quantity) || 0) * Number(asset.price))}</strong></div><button type="submit" disabled={busy || !!state.syncError}>{busy ? "Saving on tablet…" : `${side === "buy" ? "Buy" : "Sell"} now at saved price`}</button><p className="muted">Completes immediately, even offline or when the stock market is closed. This price is locked into your trade. No waiting orders or real money.</p></form></section>}</div>}
        {tab === "History" && <section className="card"><h2>Completed classroom trades</h2><p>These trades have already happened. “Awaiting backup” only means the teacher’s copy has not received them yet.</p>{!state.trades.length ? <p>No classroom trades yet. Earlier online activity remains in the online workspace.</p> : <div className="table-wrap"><table><thead><tr><th>Trade</th><th>Shares</th><th>Locked price</th><th>Total</th><th>Backup</th></tr></thead><tbody>{[...state.trades].reverse().map((t) => <tr key={t.id}><td><strong>{t.side === "buy" ? "Bought" : "Sold"} {t.symbol}</strong><small>{time(t.executedAt)}</small><details><summary>My reasoning</summary><p>{t.rationale || "No reason added."}</p><p>Confidence: {t.confidence}/5 · Price as of {time(t.asOf)}</p></details></td><td>{Number(t.quantity)}</td><td>{money(t.price)}<small>Exact: ${t.price}</small></td><td>{money(t.amount)}</td><td>{t.sequence <= state.acknowledgedSequence ? "Backed up" : "Saved on tablet · awaiting backup"}</td></tr>)}</tbody></table></div>}</section>}
        {tab === "Learn" && <section className="lesson-grid">{state.lessons.map((lesson) => <article className="card" key={lesson.id}><p className="eyebrow">Learning lab · Saved for offline reading</p><h2>{lesson.title}</h2><p>{lesson.summary}</p>{typeof lesson.content.hook === "string" && <p className="core-idea">{lesson.content.hook}</p>}{Array.isArray(lesson.content.vocabulary) && <p>{lesson.content.vocabulary.filter((v) => typeof v === "string").join(" · ")}</p>}{typeof lesson.content.check === "string" && <details><summary>Check your thinking</summary><p>{lesson.content.check}</p></details>}</article>)}<p>Trade reflections are saved in History and sync to your journal. Assignment submissions, lesson completion, and the class leaderboard are in the <a href="/app">online workspace</a>.</p></section>}
        {tab === "Device & help" && <div className="help-grid"><section className="card"><p className="eyebrow">Classroom routine</p><h2>Before and after class</h2><ol><li>Keep this student on this tablet: <strong>{state.label} · {state.studentName}</strong>.</li><li>Before class, connect to Wi-Fi and check “Ready for offline use.” Test a reload with Wi-Fi off.</li><li>After class, put all tablets on good Wi-Fi with Market Lab open. Backup and price refresh happen automatically.</li><li>Wait until every tablet says “All trades backed up,” and check Devices in your teacher workspace.</li></ol><label className="checkbox"><input type="checkbox" checked={wake} onChange={(e) => setWake(e.target.checked)} /> Keep screen awake while Market Lab is visible</label><p className="muted">Background sync is attempted when supported. A website cannot reliably wake a sleeping tablet or a closed Silk browser. Keep the tablets charging and this page visible during backup.</p></section><section className="card"><h2>Storage & recovery</h2><p>{persisted ? "Browser has granted persistent storage." : "Browser storage can be cleared by the device. Keep regular backups and avoid clearing Silk browsing data."}</p><p>Do not use private browsing, clear website data, uninstall Silk, reset the tablet, or switch browser profiles before trades are backed up.</p><button className="secondary" onClick={exportBackup}>Download backup</button><p className="muted">A backup includes the device access key. Keep it with the teacher. See the classroom guide for recovery.</p><hr /><h3>Switch students or tablets</h3><p>Sync first, then release this tablet. Sign in with the next student’s login card before preparing it again.</p><button className="secondary" disabled={busy || pending > 0} onClick={release}>Release this device</button><p><a href="/app">Open online workspace</a> · <a href="/classroom-guide">Teacher setup guide</a></p></section><section className="card"><h2>Trading rules</h2><p>Maximum in one investment: {Number(state.pack.rules.maxPositionPercent)}%. Minimum cash: {Number(state.pack.rules.minCashPercent)}%. {state.pack.rules.allowFractional ? "Fractional shares where available." : "Whole shares only."}</p><p>Season ends {time(state.pack.rules.endsAt)}. Teacher changes reach this tablet on its next successful price refresh. While offline, its last downloaded rules apply.</p><p>Other students’ results and the teacher’s reports update after each tablet syncs. Until then, standings are incomplete.</p></section></div>}
      </>}
      <footer>Market Lab · All trades and balances are simulated. Saved IEX prices can differ from other exchanges.</footer>
    </main>
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
