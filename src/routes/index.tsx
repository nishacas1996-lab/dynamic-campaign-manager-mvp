import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Cloud, CloudRain, CloudSnow, Sun, Zap, Droplets, Thermometer,
  Activity, PauseCircle, PlayCircle, History, Radio,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "DynaMo — Context-Aware Ad Campaign Manager" },
      { name: "description", content: "Weather-driven ad campaign optimization across cities and creatives." },
    ],
  }),
});

type LineItem = {
  id: number; creative_id: string; city: string; state: string;
  bid: number; daily_budget: number; updated_at: string;
};
type Weather = {
  id: number; city: string; temp_c: number; precip_mm: number;
  condition: string; fetched_at: string;
};
type TransitionLog = {
  id: number; line_item_id: number; from_state: string; to_state: string;
  reason: string; weather_snap: any; triggered_at: string;
};

const CREATIVES = ["beat_the_heat", "rainy_day", "refresh_anytime"];
const CREATIVE_LABEL: Record<string, string> = {
  beat_the_heat: "Beat the Heat",
  rainy_day: "Rainy Day",
  refresh_anytime: "Refresh Anytime",
};

function conditionIcon(c: string) {
  const k = c.toLowerCase();
  if (k.includes("snow")) return CloudSnow;
  if (k.includes("thunder") || k.includes("storm")) return Zap;
  if (k.includes("rain")) return CloudRain;
  if (k.includes("cloud") || k.includes("humid")) return Cloud;
  return Sun;
}

function conditionBadge(w?: { temp_c: number; precip_mm: number }) {
  if (!w) return { emoji: "·", label: "—", className: "bg-muted text-muted-foreground border-border" };
  if (w.precip_mm >= 1)
    return { emoji: "🌧", label: "Rainy", className: "bg-accent/15 text-accent border-accent/30" };
  if (w.temp_c >= 30)
    return { emoji: "🔥", label: "Hot", className: "bg-destructive/15 text-destructive border-destructive/30" };
  return { emoji: "✅", label: "Normal", className: "bg-success/15 text-success border-success/30" };
}

function fmtAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function reasonFor(item: LineItem, w?: Weather) {
  if (!w) return "Awaiting weather data.";
  const hot = w.temp_c >= 30;
  const rainy = w.precip_mm >= 1;
  if (item.creative_id === "beat_the_heat") {
    return hot
      ? `Temperature ${w.temp_c}°C ≥ 30°C — heat-relief creative is in window.`
      : `Temperature ${w.temp_c}°C below 30°C threshold — creative paused.`;
  }
  if (item.creative_id === "rainy_day") {
    return rainy
      ? `Precipitation ${w.precip_mm}mm — rainy-day creative active.`
      : `Precipitation ${w.precip_mm}mm under 1mm threshold — paused.`;
  }
  return `Evergreen creative — runs across all conditions in ${w.city}.`;
}

function Dashboard() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [weather, setWeather] = useState<Weather[]>([]);
  const [logs, setLogs] = useState<TransitionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [l, w, t] = await Promise.all([
        supabase.from("line_items").select("*"),
        supabase.from("weather_cache").select("*"),
        supabase.from("transition_logs").select("*").order("triggered_at", { ascending: false }).limit(20),
      ]);
      setItems((l.data ?? []) as LineItem[]);
      setWeather((w.data ?? []) as Weather[]);
      setLogs((t.data ?? []) as TransitionLog[]);
      setLoading(false);
    })();
  }, []);

  const weatherByCity = new Map(weather.map((w) => [w.city, w]));
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const cities = Array.from(new Set(items.map((i) => i.city))).sort();

  const activeCount = items.filter((i) => i.state === "active").length;
  const totalBudget = items.reduce((s, i) => s + Number(i.daily_budget), 0);
  const activeBudget = items.filter((i) => i.state === "active").reduce((s, i) => s + Number(i.daily_budget), 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-[1500px] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Radio className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">DynaMo</h1>
              <p className="text-xs text-muted-foreground font-mono">context-aware campaign manager</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono">
            <Stat label="ACTIVE" value={`${activeCount}/${items.length}`} accent="success" />
            <Stat label="BUDGET LIVE" value={`$${activeBudget}`} />
            <Stat label="BUDGET TOTAL" value={`$${totalBudget}`} />
            <div className="flex items-center gap-2 text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              LIVE
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-6 grid grid-cols-12 gap-6">
        <section className="col-span-12">
          <SectionLabel icon={Thermometer}>Weather Cache</SectionLabel>
          <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
              {["Mumbai", "Delhi", "Bangalore", "Chennai"].map((city) => {
                const w = weatherByCity.get(city);
                const badge = conditionBadge(w);
                return (
                  <div key={city} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{city}</div>
                      <div className="mt-1 flex items-baseline gap-3 font-mono text-xs text-muted-foreground">
                        <span className="inline-flex items-baseline gap-1">
                          <span className="text-lg font-semibold tabular-nums text-foreground">
                            {w ? Math.round(w.temp_c) : "—"}
                          </span>
                          <span>°C</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Droplets className="h-3 w-3" />
                          {w ? `${w.precip_mm}mm` : "—"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-mono border whitespace-nowrap ${badge.className}`}
                    >
                      <span>{badge.emoji}</span>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-8">
          <SectionLabel icon={Activity}>Line Items · {cities.length} cities × {CREATIVES.length} creatives</SectionLabel>
          <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5">City</th>
                    <th className="text-left px-4 py-2.5">Creative</th>
                    <th className="text-left px-4 py-2.5">State</th>
                    <th className="text-left px-4 py-2.5 w-[40%]">Reason</th>
                    <th className="text-right px-4 py-2.5">Bid</th>
                    <th className="text-right px-4 py-2.5 pr-4">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.flatMap((city) =>
                    CREATIVES.map((cr) => {
                      const li = items.find((i) => i.city === city && i.creative_id === cr);
                      if (!li) return null;
                      const w = weatherByCity.get(city);
                      return (
                        <tr key={li.id} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                          <td className="px-4 py-3 font-medium">{city}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {CREATIVE_LABEL[cr] ?? cr}
                          </td>
                          <td className="px-4 py-3">
                            <StateBadge state={li.state} />
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground/80 leading-snug">
                            {reasonFor(li, w)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">
                            ${Number(li.bid).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 pr-4 text-right tabular-nums font-mono text-xs">
                            ${Number(li.daily_budget).toFixed(0)}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground font-mono">Loading…</div>
            )}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4">
          <SectionLabel icon={History}>Transition Log</SectionLabel>
          <div className="mt-3 rounded-lg border border-border bg-card divide-y divide-border max-h-[640px] overflow-y-auto">
            {logs.map((e) => {
              const li = itemMap.get(e.line_item_id);
              const becameActive = e.to_state === "active";
              const snap = e.weather_snap ?? {};
              return (
                <div key={e.id} className="p-3 hover:bg-surface-2/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      {becameActive ? (
                        <PlayCircle className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <PauseCircle className="h-3.5 w-3.5 text-warning" />
                      )}
                      <span className="text-muted-foreground">{e.from_state}</span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className={becameActive ? "text-success" : "text-warning"}>
                        {e.to_state}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {fmtAgo(e.triggered_at)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <span className="font-medium">{li?.city ?? snap.city ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {li ? CREATIVE_LABEL[li.creative_id] ?? li.creative_id : "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-foreground/70 leading-snug">{e.reason}</div>
                  {snap.condition && (
                    <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">
                      snap: {snap.temp_c}°C · {snap.precip_mm}mm · {snap.condition}
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && logs.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground font-mono">No transitions yet</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] text-muted-foreground tracking-wider">{label}</span>
      <span className={`tabular-nums ${accent === "success" ? "text-success" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  if (state === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-mono bg-success/15 text-success border border-success/30">
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        ACTIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-mono bg-muted text-muted-foreground border border-border">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
      {state.toUpperCase()}
    </span>
  );
}
