import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "online" | "offline" | "warn" }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide";
  const variants: Record<string, string> = {
    default: "bg-slate-800 text-slate-300 border border-slate-700",
    online: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    offline: "bg-red-500/20 text-red-400 border border-red-500/30",
    warn: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  };
  return <span className={cn(base, variants[variant], className)} {...props} />;
}
