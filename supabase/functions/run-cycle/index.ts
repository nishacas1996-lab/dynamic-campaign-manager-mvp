// Decision cycle: evaluate weather per city and toggle line item states.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai"];

function jitter(base: number, spread: number) {
  return +(base + (Math.random() - 0.5) * spread).toFixed(1);
}

function syntheticWeather(city: string) {
  // Vary the synthetic conditions to keep cycles interesting.
  const profiles: Record<string, { temp: number; precip: number; cond: string }> = {
    Mumbai:    { temp: jitter(31, 6),  precip: Math.random() < 0.45 ? jitter(3, 4) : 0, cond: "humid" },
    Delhi:     { temp: jitter(34, 8),  precip: Math.random() < 0.15 ? jitter(1.5, 2) : 0, cond: "hot" },
    Bangalore: { temp: jitter(26, 4),  precip: Math.random() < 0.40 ? jitter(2, 3) : 0, cond: "cloudy" },
    Chennai:   { temp: jitter(32, 5),  precip: Math.random() < 0.35 ? jitter(2.5, 4) : 0, cond: "humid" },
  };
  const p = profiles[city] ?? { temp: jitter(28, 5), precip: 0, cond: "clear" };
  return {
    temp_c: Math.max(15, p.temp),
    precip_mm: Math.max(0, +p.precip.toFixed(1)),
    condition: p.precip >= 1 ? "rain" : p.temp >= 32 ? "hot" : p.cond,
  };
}

function decide(creative: string, w: { temp_c: number; precip_mm: number }): { state: "active" | "paused"; reason: string } {
  const hot = w.temp_c >= 30;
  const rainy = w.precip_mm >= 1;
  if (creative === "beat_the_heat") {
    return hot
      ? { state: "active", reason: `Temperature ${w.temp_c}°C ≥ 30°C — heat-relief creative is in window.` }
      : { state: "paused", reason: `Temperature ${w.temp_c}°C below 30°C threshold — creative paused.` };
  }
  if (creative === "rainy_day") {
    return rainy
      ? { state: "active", reason: `Precipitation ${w.precip_mm}mm — rainy-day creative active.` }
      : { state: "paused", reason: `Precipitation ${w.precip_mm}mm under 1mm threshold — paused.` };
  }
  // refresh_anytime — handled contextually per city (see cycle loop).
  return { state: "paused", reason: `Evergreen creative — gated by other creatives in the city.` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Refresh weather cache for each city.
    const now = new Date().toISOString();
    const weatherRows: any[] = [];
    for (const city of CITIES) {
      const w = syntheticWeather(city);
      const { data: existing } = await supabase
        .from("weather_cache").select("id").eq("city", city).maybeSingle();
      if (existing) {
        await supabase.from("weather_cache")
          .update({ ...w, fetched_at: now })
          .eq("id", existing.id);
      } else {
        await supabase.from("weather_cache").insert({ city, ...w, fetched_at: now });
      }
      weatherRows.push({ city, ...w });
    }
    const weatherByCity = new Map(weatherRows.map((w) => [w.city, w]));

    // 2. Evaluate every line item; flip + log when state changes.
    const { data: items, error: itemsErr } = await supabase
      .from("line_items").select("*");
    if (itemsErr) throw itemsErr;

    let transitions = 0;
    // Group items by city so refresh_anytime can be gated on siblings.
    const byCity = new Map<string, any[]>();
    for (const li of items ?? []) {
      if (!byCity.has(li.city)) byCity.set(li.city, []);
      byCity.get(li.city)!.push(li);
    }

    for (const [city, cityItems] of byCity) {
      const w = weatherByCity.get(city);
      if (!w) continue;

      // First decide weather-driven creatives.
      const decisions = new Map<number, { state: "active" | "paused"; reason: string }>();
      for (const li of cityItems) {
        if (li.creative_id === "refresh_anytime") continue;
        decisions.set(li.id, decide(li.creative_id, w));
      }

      // Mutual exclusion: rainy_day wins over beat_the_heat when both qualify.
      const rainyItem = cityItems.find((i) => i.creative_id === "rainy_day");
      const heatItem = cityItems.find((i) => i.creative_id === "beat_the_heat");
      if (rainyItem && heatItem) {
        const rainyD = decisions.get(rainyItem.id);
        const heatD = decisions.get(heatItem.id);
        if (rainyD?.state === "active" && heatD?.state === "active") {
          decisions.set(heatItem.id, {
            state: "paused",
            reason: `Rainy-day creative is active in ${city} — beat-the-heat paused (mutually exclusive).`,
          });
        }
      }

      // refresh_anytime runs only if no other creative in this city is active.
      const anyOtherActive = Array.from(decisions.values()).some((d) => d.state === "active");
      for (const li of cityItems) {
        if (li.creative_id !== "refresh_anytime") continue;
        decisions.set(
          li.id,
          anyOtherActive
            ? { state: "paused", reason: `Evergreen paused — another creative is active in ${city}.` }
            : { state: "active", reason: `No weather-driven creative active in ${city} — evergreen takes the slot.` },
        );
      }

      for (const li of cityItems) {
        const decision = decisions.get(li.id);
        if (!decision || decision.state === li.state) continue;

        await supabase.from("line_items")
          .update({ state: decision.state, updated_at: now })
          .eq("id", li.id);

        await supabase.from("transition_logs").insert({
          line_item_id: li.id,
          from_state: li.state,
          to_state: decision.state,
          reason: decision.reason,
          weather_snap: { city: w.city, temp_c: w.temp_c, precip_mm: w.precip_mm, condition: w.condition },
        });
        transitions++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, evaluated: items?.length ?? 0, transitions, weather: weatherRows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("run-cycle error", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
