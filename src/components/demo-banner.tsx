import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Development data notice">
      <FlaskConical size={15} aria-hidden="true" />
      Development replay — prices are deterministic practice data, not live market quotes or investing advice.
    </aside>
  );
}
