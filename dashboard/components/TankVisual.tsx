"use client";
import { cn } from "@/lib/utils";

type Props = {
  level: number; // 0-100
  online: boolean;
};

export function TankVisual({ level, online }: Props) {
  const clamped = Math.max(0, Math.min(100, level));
  const heightPercent = clamped; // langsung pakai persen

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="tank-container">
        {/* skala kiri */}
        <div className="absolute left-2 top-2 bottom-2 flex flex-col justify-between text-[10px] text-slate-500 font-mono z-10">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
        {/* garis skala */}
        <div className="absolute left-0 right-0 top-[0%] h-px bg-slate-700/40 z-10" />
        <div className="absolute left-0 right-0 top-[25%] h-px bg-slate-700/40 z-10" />
        <div className="absolute left-0 right-0 top-[50%] h-px bg-slate-700/40 z-10" />
        <div className="absolute left-0 right-0 top-[75%] h-px bg-slate-700/40 z-10" />

        {/* air */}
        <div
          className={cn("tank-water", !online && "opacity-40 grayscale")}
          style={{ height: `${heightPercent}%` }}
        >
          <div className="wave" />
          <div className="wave wave2" />
          {/* highlight */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* angka besar tengah */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <span className="text-6xl font-black tracking-tighter text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {clamped}
            <span className="text-3xl align-super ml-1">%</span>
          </span>
          <span className="mt-1 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold tracking-widest text-white/90 backdrop-blur">
            {online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* border glow */}
        <div className="pointer-events-none absolute inset-0 rounded-[24px] border border-sky-500/20" />
      </div>

      {/* label bawah */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
        Tangki 1 — Transparan Wave 60fps
      </div>
    </div>
  );
}
