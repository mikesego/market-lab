"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fffdf5", color: "#153d34" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
          <div style={{ maxWidth: 560, padding: "2rem", border: "1px solid #153d34", borderRadius: "1rem", boxShadow: "5px 5px 0 #153d34", textAlign: "center" }}>
            <p style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", fontSize: ".75rem" }}>Market Lab</p>
            <h1 style={{ fontSize: "2.5rem", margin: ".7rem 0" }}>We hit an unexpected problem.</h1>
            <p style={{ lineHeight: 1.6 }}>Your portfolio records are safe. Try loading the app again.</p>
            <button onClick={reset} type="button" style={{ marginTop: "1rem", padding: ".8rem 1rem", borderRadius: ".7rem", border: "1px solid #153d34", background: "#c7f36b", color: "#153d34", fontWeight: 800, cursor: "pointer" }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
