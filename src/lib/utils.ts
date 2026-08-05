import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string, options?: { compact?: boolean; cents?: boolean }) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: options?.compact ? "compact" : "standard",
    minimumFractionDigits: options?.cents === false ? 0 : 2,
    maximumFractionDigits: options?.cents === false ? 0 : 2,
  }).format(amount);
}

export function formatPercent(value: number | string, digits = 2) {
  const amount = Number(value);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toFixed(digits)}%`;
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
