export default function StudentLoading() {
  return <div aria-live="polite"><span className="eyebrow">Loading workspace</span><div className="stat-grid" style={{ marginTop: "1.5rem" }}>{Array.from({ length: 4 }, (_, index) => <div key={index} className="card stat-card" style={{ background: "var(--paper-2)" }} />)}</div></div>;
}
