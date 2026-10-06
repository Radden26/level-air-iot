"use client";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type Point = { time: string; level: number; raw: number };

export function HistoryChart({ data }: { data: Point[] }) {
  const hasData = data && data.length > 0;
  return (
    <Card>
      <CardTitle>Grafik 24 Jam</CardTitle>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-sm text-slate-500">
            Belum ada data history — tunggu ESP32 push tiap 1 menit ke /tanks/tangki1/history
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="lv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, color: "#e2e8f0" }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v: number) => [`${v}%`, "Level"]}
                />
                <Area type="monotone" dataKey="level" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#lv)" dot={false} activeDot={{ r: 4, fill: "#0ea5e9" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Sumber: Firebase RTDB <code className="text-sky-400">/tanks/tangki1/history</code> — filter 24 jam terakhir (maks 200 titik).</p>
      </CardContent>
    </Card>
  );
}
