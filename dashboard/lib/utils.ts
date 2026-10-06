import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function levelLabel(persen: number): string {
  if (persen >= 100) return "PENUH";
  if (persen >= 75) return "TINGGI";
  if (persen >= 50) return "SEDANG";
  if (persen >= 25) return "RENDAH";
  return "KOSONG";
}

export function levelColor(persen: number): string {
  if (persen >= 100) return "#0ea5e9";
  if (persen >= 75) return "#22c55e";
  if (persen >= 50) return "#eab308";
  if (persen >= 25) return "#f97316";
  return "#475569";
}

export function formatTime(timestamp: number): string {
  if (!timestamp) return "-";
  // timestamp bisa epoch detik atau millis kecil
  const ms = timestamp > 1e12 ? timestamp : timestamp > 1e10 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
}

export function formatTimeOnly(timestamp: number): string {
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
