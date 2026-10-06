"use client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { levelLabel, formatTime } from "@/lib/utils";
import { Wifi, Clock3, Activity, AlertTriangle, Droplets } from "lucide-react";

type Props = {
  level: number;
  bitmask: number;
  online: boolean;
  latency?: number;
  lastUpdate?: number;
  errorCode?: number;
  rssi?: number;
};

export function StatusCards({ level, online, latency, lastUpdate, errorCode, rssi }: Props) {
  const label = levelLabel(level);
  const colorMap: Record<string, string> = {
    KOSONG: "text-slate-400",
    RENDAH: "text-orange-400",
    SEDANG: "text-yellow-400",
    TINGGI: "text-green-400",
    PENUH: "text-sky-400",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-sky-400" /> Level
        </CardTitle>
        <CardContent className="pt-2">
          <div className="flex items-baseline gap-3">
            <span className={`text-3xl font-black ${colorMap[label]}`}>{label}</span>
            <span className="text-sm text-slate-500">{level}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-sky-500 transition-all duration-700"
              style={{ width: `${level}%` }}
            />
          </div>
          {errorCode !== 0 && errorCode !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Probe fault (bitmask non-sekuensial)
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-emerald-400" /> Koneksi
        </CardTitle>
        <CardContent className="pt-2">
          <div className="flex items-center gap-2">
            <Badge variant={online ? "online" : "offline"}>
              <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {online ? "ONLINE" : "OFFLINE"}
            </Badge>
            {online && latency !== undefined && (
              <span className="text-xs text-slate-400">{latency} ms</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Latency Modbus → Firebase {online ? "normal" : "terputus >5x gagal"}. {rssi ? `RSSI ${rssi} dBm` : ""}
          </div>
        </CardContent>
      </Card>

      <Card className="sm:col-span-2 lg:col-span-1">
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-slate-400" /> Last Update
        </CardTitle>
        <CardContent className="pt-2">
          <div className="text-sm font-medium text-slate-200">{formatTime(lastUpdate || 0)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            {lastUpdate ? `${Math.floor((Date.now() - (lastUpdate > 1e12 ? lastUpdate : lastUpdate * 1000)) / 1000)} detik lalu` : "belum ada data"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
