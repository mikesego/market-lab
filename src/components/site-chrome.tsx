import Link from "next/link";

import { Brand } from "./brand";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container-shell site-header-inner">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          <Link className="focus-ring" href="/#how">How it works</Link>
          <Link className="focus-ring" href="/educators">For educators</Link>
          <Link className="focus-ring" href="/teacher">Teacher login</Link>
          <Link className="button-primary focus-ring" href="/join">Join a class</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-shell footer-grid">
        <div>
          <Brand inverse />
          <p style={{ maxWidth: 330, color: "#c7d5d0", lineHeight: 1.65, marginTop: "1rem" }}>
            Real market thinking. Practice money. Better questions.
          </p>
        </div>
        <nav aria-label="Product">
          <strong>Product</strong>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/educators">Educators</Link>
          <Link href="/status">System status</Link>
        </nav>
        <nav aria-label="Policies">
          <strong>Trust</strong>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/accessibility">Accessibility</Link>
        </nav>
        <nav aria-label="Access">
          <strong>Access</strong>
          <Link href="/join">Student join</Link>
          <Link href="/teacher">Teacher login</Link>
          <a href="mailto:hello@stocks.mikesego.com">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
