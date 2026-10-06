"use client";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { formatTimeOnly, levelLabel } from "@/lib/utils";

type Log = {
  id: string;
  level_persen: number;
  bitmask: number;
  timestamp: number;
  label?: string;
};

export function LogTable({ logs }: { logs: Log[] }) {
  return (
    <Card>
      <CardTitle>Tabel Log Realtime</CardTitle>
      <CardContent>
        <div className="max-h-[340px] overflow-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Bitmask</th>
                <th className="px-4 py-3">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Belum ada log — data masuk otomatis dari Firebase history + realtime
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2 font-mono text-xs text-slate-300">{formatTimeOnly(l.timestamp)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="font-bold text-sky-400">{l.level_persen}%</span>
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-slate-800">
                          <span className="block h-full bg-sky-500" style={{ width: `${l.level_persen}%` }} />
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{l.bitmask?.toString(2).padStart(4, "0")}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
                        {l.label || levelLabel(l.level_persen)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Menampilkan {logs.length} entri terbaru. Update realtime tiap 2 detik (polling ESP32) & history tiap 1 menit.</p>
      </CardContent>
    </Card>
  );
}
