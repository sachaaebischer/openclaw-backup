/**
 * Prints today's weather for Düdingen, Switzerland (free Open-Meteo API, no key).
 * Used by the agent's daily-summary cron. Run: `npm run weather`.
 */
const LAT = 46.85;
const LON = 7.19;

const WMO: Record<number, string> = {
  0: "☀️ Clear",
  1: "🌤️ Mostly clear",
  2: "⛅ Partly cloudy",
  3: "☁️ Overcast",
  45: "🌫️ Fog",
  48: "🌫️ Rime fog",
  51: "🌦️ Light drizzle",
  53: "🌦️ Drizzle",
  55: "🌧️ Heavy drizzle",
  61: "🌧️ Light rain",
  63: "🌧️ Rain",
  65: "🌧️ Heavy rain",
  71: "🌨️ Light snow",
  73: "🌨️ Snow",
  75: "❄️ Heavy snow",
  80: "🌦️ Rain showers",
  81: "🌧️ Showers",
  82: "⛈️ Violent showers",
  95: "⛈️ Thunderstorm",
  96: "⛈️ Thunderstorm w/ hail",
};

async function main() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Europe%2FZurich&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
  const d: any = await res.json();
  const day = d.daily;
  const code = day.weather_code[0];
  const desc = WMO[code] ?? `code ${code}`;
  const out = `Düdingen today: ${desc}, ${Math.round(day.temperature_2m_min[0])}–${Math.round(
    day.temperature_2m_max[0],
  )}°C, rain ${day.precipitation_probability_max[0]}%, wind up to ${Math.round(
    day.wind_speed_10m_max[0],
  )} km/h.`;
  process.stdout.write(out + "\n");
}

main().catch((err) => {
  console.error(`weather unavailable: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
