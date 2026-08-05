import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return <main id="main-content" className="dot-grid" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}><div style={{ textAlign: "center", maxWidth: 620 }}><span className="eyebrow">404 · Not found</span><h1 className="display" style={{ fontSize: "clamp(4rem,10vw,8rem)", lineHeight: .9, margin: "1rem 0" }}>That ticker isn’t on our board.</h1><p className="muted" style={{ lineHeight: 1.65 }}>The page may have moved, the symbol may be unavailable, or the class link may have expired.</p><Link className="button-primary" href="/"><ArrowLeft size={17} /> Back to Market Lab</Link></div></main>;
}
