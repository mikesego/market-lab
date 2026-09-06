import { Radio } from "lucide-react";

export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Simulation notice">
      <Radio size={15} aria-hidden="true" />
      Classroom simulation · Live Alpaca IEX market data · All trading and money are simulated.
    </aside>
  );
}
