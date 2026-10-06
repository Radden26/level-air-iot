"use client";
import { cn } from "@/lib/utils";

type Props = {
  bitmask: number;
};

const LEVELS = [
  { label: "25%", sub: "Merah",  bit: 0, color: "#ef4444", bg: "bg-red-500", text: "text-red-400" },
  { label: "50%", sub: "Kuning", bit: 1, color: "#eab308", bg: "bg-yellow-400", text: "text-yellow-400" },
  { label: "75%", sub: "Hijau",  bit: 2, color: "#22c55e", bg: "bg-green-500", text: "text-green-400" },
  { label: "100%", sub: "Biru",  bit: 3, color: "#0ea5e9", bg: "bg-sky-500", text: "text-sky-400" },
];

export function LedIndicators({ bitmask }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Indikator Probe</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {LEVELS.map((lvl) => {
          const active = ((bitmask >> lvl.bit) & 1) === 1;
          return (
            <div
              key={lvl.label}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                active
                  ? "border-slate-700 bg-slate-800/80 shadow-lg"
                  : "border-slate-800 bg-slate-900/40 opacity-60"
              )}
            >
              <div
                className={cn(
                  "h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all",
                  active ? "bg-slate-900" : "bg-slate-800 border-slate-700"
                )}
                style={{
                  borderColor: active ? lvl.color : undefined,
                  boxShadow: active ? `0 0 20px ${lvl.color}, 0 0 40px ${lvl.color}40` : undefined,
                }}
              >
                <div
                  className={cn("h-9 w-9 rounded-full transition-all", active ? "" : "bg-slate-700")}
                  style={{
                    background: active ? lvl.color : undefined,
                    boxShadow: active ? `0 0 12px ${lvl.color}` : undefined,
                  }}
                />
              </div>
              <div className="text-center">
                <div className={cn("text-sm font-bold", active ? lvl.text : "text-slate-500")}>{lvl.label}</div>
                <div className="text-[11px] tracking-wide text-slate-500">{lvl.sub}</div>
                <div
                  className={cn(
                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest",
                    active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-500 border border-slate-700"
                  )}
                >
                  {active ? "AKTIF" : "TIDAK"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Bitmask <code className="rounded bg-slate-800 px-1 py-0.5 text-sky-400">{bitmask.toString(2).padStart(4, "0")}</code> (bit3..bit0 = 100%..25%). LOW optocoupler = ada air.
      </p>
    </div>
  );
}
