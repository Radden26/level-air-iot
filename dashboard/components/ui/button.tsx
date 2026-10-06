import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition";
  const variants: Record<string, string> = {
    primary: "bg-[#0ea5e9] text-white hover:bg-sky-600 shadow-lg shadow-sky-500/20",
    ghost: "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
