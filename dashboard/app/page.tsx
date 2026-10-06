"use client";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseDB } from "@/lib/firebase";
import { ref, onValue, query, orderByChild, limitToLast } from "firebase/database";
import { TankVisual } from "@/components/TankVisual";
import { LedIndicators } from "@/components/LedIndicators";
import { StatusCards } from "@/components/StatusCards";
import { HistoryChart } from "@/components/HistoryChart";
import { LogTable } from "@/components/LogTable";
import { Badge } from "@/components/ui/badge";
import { Droplets, Radio, Settings2 } from "lucide-react";

type RealtimeData = {
  level_persen: number;
  bitmask: number;
  online: boolean;
  last_update: number;
  latency_ms?: number;
  error_code?: number;
  label?: string;
  rssi?: number;
  slave_id?: number;
};

type HistoryEntry = {
  level_persen: number;
  bitmask: number;
  timestamp: number;
  label?: string;
};

export default function Page() {
  const [rt, setRt] = useState<RealtimeData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  // tick tiap detik untuk "x detik lalu"
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const db = getFirebaseDB();
    const tankPath = process.env.NEXT_PUBLIC_TANK_PATH || "/tanks/tangki1";
    const rRef = ref(db, `${tankPath}/realtime`);
    const hRef = query(ref(db, `${tankPath}/history`), orderByChild("timestamp"), limitToLast(200));

    const unsubRt = onValue(rRef, (snap) => {
      const v = snap.val() as RealtimeData | null;
      if (v) setRt(v);
      else setRt({ level_persen: 0, bitmask: 0, online: false, last_update: 0, error_code: 0 });
    });

    const unsubHist = onValue(hRef, (snap) => {
      const v = snap.val();
      if (!v) { setHistory([]); return; }
      const arr: HistoryEntry[] = Object.entries(v).map(([k, val]: any) => ({
        id: k,
        ...val,
        timestamp: val.timestamp || parseInt(k) || Date.now() / 1000,
      }));
      arr.sort((a, b) => a.timestamp - b.timestamp);
      // filter 24 jam terakhir
      const cutoff = Date.now() / 1000 - 24 * 3600;
      const filtered = arr.filter((e) => e.timestamp >= cutoff);
      setHistory(filtered);
    });

    return () => {
      unsubRt();
      unsubHist();
    };
  }, []);

  const level = rt?.level_persen ?? 0;
  const bitmask = rt?.bitmask ?? 0;
  const online = rt?.online ?? false;
  const latency = rt?.latency_ms;
  const lastUpdate = rt?.last_update;
  const errorCode = rt?.error_code ?? 0;

  const chartData = useMemo(() => {
    return history.map((h) => {
      const ms = h.timestamp > 1e12 ? h.timestamp : h.timestamp * 1000;
      const d = new Date(ms);
      const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      return { time, level: h.level_persen, raw: h.timestamp };
    });
  }, [history]);

  const logData = useMemo(() => {
    // gabung history + realtime terbaru di atas (limit 50, terbaru dulu)
    const histLogs = [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50)
      .map((h: any) => ({
        id: String(h.timestamp) + "-" + h.level_persen,
        level_persen: h.level_persen,
        bitmask: h.bitmask,
        timestamp: h.timestamp,
        label: h.label,
      }));
    return histLogs;
  }, [history]);

  // hitung offline timeout: jika last_update > 10 detik lalu tapi masih online=true, anggap stale
  const isStale = useMemo(() => {
    if (!lastUpdate) return true;
    const ms = lastUpdate > 1e12 ? lastUpdate : lastUpdate * 1000;
    return Date.now() - ms > 15000 && online;
  }, [lastUpdate, online, now]);

  return (
    <main className="mx-auto max-w-[1280px] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
            <Droplets className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Monitoring Level Air — Tangki 1</h1>
            <p className="text-xs text-slate-400">Modbus RTU RS485 • ESP32 Master • Firebase Realtime Database • Next.js 14</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={online && !isStale ? "online" : "offline"}>
            <span className={`h-2 w-2 rounded-full ${online && !isStale ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {online && !isStale ? "ONLINE" : isStale ? "STALE" : "OFFLINE"}
            {latency !== undefined && online ? ` • ${latency}ms` : ""}
          </Badge>
          <Badge variant="default" className="gap-1">
            <Radio className="h-3 w-3" /> ID {rt?.slave_id ?? 1} • {process.env.NEXT_PUBLIC_TANK_PATH || "/tanks/tangki1"}
          </Badge>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400 md:inline-flex">
            <Settings2 className="h-3 w-3" /> Baud 9600 8N1
          </span>
        </div>
      </header>

      {/* Top grid: Tank + Right panels */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Tank visual center */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
          <TankVisual level={level} online={online && !isStale} />
          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-center">
            <div className="text-xs tracking-widest text-sky-300 uppercase">Level Saat Ini</div>
            <div className="text-2xl font-black text-white">{level}% — {(rt?.label as string) || (level >= 100 ? "PENUH" : level >= 75 ? "TINGGI" : level >= 50 ? "SEDANG" : level >= 25 ? "RENDAH" : "KOSONG")}</div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <StatusCards level={level} bitmask={bitmask} online={online && !isStale} latency={latency} lastUpdate={lastUpdate} errorCode={errorCode} rssi={rt?.rssi} />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
            <LedIndicators bitmask={bitmask} />
          </div>
        </div>
      </div>

      {/* Middle: Chart + Log */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <HistoryChart data={chartData} />
        </div>
        <div className="lg:col-span-2">
          <LogTable logs={logData} />
        </div>
      </div>

      {/* Footer info */}
      <footer className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 text-center text-xs leading-relaxed text-slate-500">
        <p>
          Arsitektur: <span className="text-slate-300">Probe Stainless → BC547 → PC817 → Arduino Nano (Slave ID 1, RS485 MAX485 DE/RE D2 RO D0 DI D1 @9600) → ESP32 Master (GPIO4/16/17) → Firebase RTDB</span>
        </p>
        <p className="mt-1">
          Wiring RS485: <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-400">A-A, B-B, GND-GND</code> + R terminasi 120Ω di kedua ujung. Ganti SLAVE_ID di <code className="text-amber-400">arduino-slave/src/main.cpp</code> & <code className="text-amber-400">esp32-master/src/main.cpp</code> lalu Re-Flash. Lihat README.md
        </p>
      </footer>
    </main>
  );
}
