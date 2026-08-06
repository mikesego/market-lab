import { Radio } from "lucide-react";

export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Personal demonstration notice">
      <Radio size={15} aria-hidden="true" />
      Personal demo · Live Alpaca IEX market data · All trading and money are simulated.
    </aside>
  );
}
