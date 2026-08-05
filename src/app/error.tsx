"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main id="main-content" style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "2rem" }}><div className="card-strong" style={{ maxWidth: 560, padding: "2rem", textAlign: "center" }}><span className="eyebrow">Something went wrong</span><h1 className="display" style={{ fontSize: "3rem", margin: ".7rem 0" }}>That page hit a snag.</h1><p className="muted" style={{ lineHeight: 1.65 }}>Your portfolio records are stored separately from this page. Try loading it again; if the issue continues, tell your teacher what you were doing.</p><button className="button-primary" onClick={reset} type="button"><RefreshCw size={17} /> Try again</button></div></main>;
}
