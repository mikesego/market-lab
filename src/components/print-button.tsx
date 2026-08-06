"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <button className="button-secondary no-print" type="button" onClick={() => window.print()}><Printer size={16} /> {label}</button>;
}
