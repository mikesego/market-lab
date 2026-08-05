import { SiteFooter, SiteHeader } from "./site-chrome";

export function PublicInfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <header className="dot-grid" style={{ borderBottom: "1px solid var(--line)", padding: "6rem 0 4rem" }}>
          <div className="container-shell">
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="display" style={{ maxWidth: 900, fontSize: "clamp(3.5rem,8vw,7.5rem)", lineHeight: .9, margin: "1rem 0 1.3rem" }}>{title}</h1>
            <p style={{ maxWidth: 760, color: "#456259", fontSize: "1.15rem", lineHeight: 1.7 }}>{intro}</p>
          </div>
        </header>
        <div className="container-shell" style={{ padding: "4rem 0 7rem" }}>{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function InfoSections({ sections }: { sections: { title: string; body: React.ReactNode }[] }) {
  return <div style={{ maxWidth: 860, display: "grid", gap: "2.7rem" }}>{sections.map((section) => <section key={section.title}><h2 className="display" style={{ fontSize: "2.3rem", margin: "0 0 .7rem" }}>{section.title}</h2><div className="muted" style={{ fontSize: ".98rem", lineHeight: 1.75 }}>{section.body}</div></section>)}</div>;
}
