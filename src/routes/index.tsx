import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Cloud, CloudRain, CloudSnow, Sun, Zap, Wind, Droplets, Thermometer,
  Activity, PauseCircle, PlayCircle, History, Radio,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "DynaMo — Context-Aware Ad Campaign Manager" },
      { name: "description", content: "Real-time weather-driven ad campaign optimization across cities and creatives." },
    ],
  }),
});

type City = {
  id: string; name: string; temp_c: number; condition: string;
  humidity: number; wind_kph: number; updated_at: string;
};
type LineItem = {
  id: string; city_id: string; creative: string; state: "active" | "paused";
  reason: string; budget_usd: number; spend_usd: number; impressions: number;
  ctr: number; updated_at: string;
};
type AuditEntry = {
  id: string; line_item_id: string; from_state: string; to_state: string;
  reason: string; created_at: string;
};

function conditionIcon(c: string) {
  const k = c.toLowerCase();
  if (k.includes("snow")) return CloudSnow;
  if (k.includes("thunder")) return Zap;
  if (k.includes("rain")) return CloudRain;
  if (k.includes("cloud")) return Cloud;
  return Sun;
}

function fmtNum(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function fmtCurrency(n: number) {
  return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
function fmtAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Dashboard() {
  const [cities, setCities] = useState<City[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, l, a] = await Promise.all([
        supabase.from("cities").select("*").order("name"),
        supabase.from("line_items").select("*"),
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(15),
      ]);
      setCities((c.data ?? []) as City[]);
      setItems((l.data ?? []) as LineItem[]);
      setAudit((a.data ?? []) as AuditEntry[]);
      setLoading(false);
    })();
  }, []);

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const cityMap = new Map(cities.map((c) => [c.id, c]));
  const creatives = ["Umbrella Promo", "Sunscreen Sale", "Hot Coffee"];

  const activeCount = items.filter((i) => i.state === "active").length;
  const totalSpend = items.reduce((s, i) => s + Number(i.spend_usd), 0);
  const totalImpressions = items.reduce((s, i) => s + i.impressions, 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="mx-auto max-w-[1500px] px-6 py-4 flex items-center justify-between">
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
            <Stat label="SPEND" value={fmtCurrency(totalSpend)} />
            <Stat label="IMPRS" value={fmtNum(totalImpressions)} />
            <div className="flex items-center gap-2 text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              LIVE
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-6 grid grid-cols-12 gap-6">
        {/* Cities + Weather strip */}
        <section className="col-span-12">
          <SectionLabel icon={Thermometer}>Conditions</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {cities.map((c) => {
              const Icon = conditionIcon(c.condition);
              return (
                <div key={c.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{c.condition}</div>
                    </div>
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tabular-nums">{Math.round(c.temp_c)}</span>
                    <span className="text-sm text-muted-foreground">°C</span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground font-mono">
                    <span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3" />{c.humidity}%</span>
                    <span className="inline-flex items-center gap-1"><Wind className="h-3 w-3" />{Math.round(c.wind_kph)}kph</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Line items matrix */}
        <section className="col-span-12 lg:col-span-8">
          <SectionLabel icon={Activity}>Line Items · 4 cities × 3 creatives</SectionLabel>
          <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5">City</th>
                    <th className="text-left px-4 py-2.5">Creative</th>
                    <th className="text-left px-4 py-2.5">State</th>
                    <th className="text-left px-4 py-2.5 w-[40%]">Reason</th>
                    <th className="text-right px-4 py-2.5">Spend</th>
                    <th className="text-right px-4 py-2.5">Impr</th>
                    <th className="text-right px-4 py-2.5 pr-4">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.flatMap((c) =>
                    creatives.map((cr) => {
                      const li = items.find((i) => i.city_id === c.id && i.creative === cr);
                      if (!li) return null;
                      const active = li.state === "active";
                      return (
                        <tr key={li.id} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cr}</td>
                          <td className="px-4 py-3">
                            <StateBadge state={li.state} />
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground/80 leading-snug">{li.reason}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{fmtCurrency(Number(li.spend_usd))}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{fmtNum(li.impressions)}</td>
                          <td className="px-4 py-3 pr-4 text-right tabular-nums font-mono text-xs">
                            <span className={active ? "text-success" : "text-muted-foreground"}>
                              {Number(li.ctr).toFixed(2)}%
                            </span>
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

        {/* Audit log */}
        <section className="col-span-12 lg:col-span-4">
          <SectionLabel icon={History}>Audit Log</SectionLabel>
          <div className="mt-3 rounded-lg border border-border bg-card divide-y divide-border max-h-[640px] overflow-y-auto">
            {audit.map((e) => {
              const li = itemMap.get(e.line_item_id);
              const city = li ? cityMap.get(li.city_id) : undefined;
              const becameActive = e.to_state === "active";
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
                      <span className={becameActive ? "text-success" : "text-warning"}>{e.to_state}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{fmtAgo(e.created_at)}</span>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <span className="font-medium">{city?.name ?? "—"}</span>
                    <span className="text-muted-foreground"> · {li?.creative ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-foreground/70 leading-snug">{e.reason}</div>
                </div>
              );
            })}
            {!loading && audit.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground font-mono">No recent changes</div>
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
      <span className={`tabular-nums ${accent === "success" ? "text-success" : "text-foreground"}`}>{value}</span>
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

function StateBadge({ state }: { state: "active" | "paused" }) {
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
      PAUSED
    </span>
  );
}
