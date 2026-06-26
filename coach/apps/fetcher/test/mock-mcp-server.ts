import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * A fake tracker MCP server used to test the fetcher end-to-end without real
 * credentials. Mimics the shape a real tracker MCP might return.
 */

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function seeded(n: number, base: number, spread: number): number {
  // Deterministic pseudo-random so repeated runs are stable.
  const x = Math.sin(n * 12.9898) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.round((base + (frac - 0.5) * spread) * 10) / 10;
}

function dailyHealth(days: number) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push({
      date: dateNDaysAgo(i),
      sleepHours: seeded(i + 1, 7.3, 1.6),
      sleepScore: Math.round(seeded(i + 2, 78, 24)),
      hrv: Math.round(seeded(i + 3, 62, 22)),
      restingHeartRate: Math.round(seeded(i + 4, 52, 8)),
      recoveryScore: Math.round(seeded(i + 5, 74, 30)),
      bodyBattery: Math.round(seeded(i + 6, 70, 40)),
      steps: Math.round(seeded(i + 7, 9000, 6000)),
    });
  }
  return out;
}

function activities(days: number) {
  const sports = ["floorball", "cycling", "running", "strength"];
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    if (i % 2 !== 0) continue; // a workout every other day
    const sport = sports[i % sports.length];
    out.push({
      activityId: `mock-${dateNDaysAgo(i)}-${sport}`,
      date: dateNDaysAgo(i),
      startTime: "18:00",
      sport,
      durationSeconds: Math.round(seeded(i + 11, 70, 60)) * 60,
      distanceMeters: sport === "strength" ? 0 : Math.round(seeded(i + 12, 12, 16)) * 1000,
      averageHr: Math.round(seeded(i + 13, 138, 40)),
      maxHr: Math.round(seeded(i + 14, 172, 24)),
      calories: Math.round(seeded(i + 15, 600, 500)),
      trainingLoad: Math.round(seeded(i + 16, 120, 120)),
    });
  }
  return out;
}

async function main() {
  const server = new McpServer({ name: "mock-tracker", version: "0.1.0" });

  server.tool(
    "get_daily_health",
    "Returns daily health metrics for the last N days",
    { days: z.number().int().positive().max(120).optional() },
    async ({ days }) => ({
      content: [{ type: "text", text: JSON.stringify(dailyHealth(days ?? 14)) }],
    }),
  );

  server.tool(
    "get_activities",
    "Returns workouts for the last N days",
    { days: z.number().int().positive().max(120).optional() },
    async ({ days }) => ({
      content: [{ type: "text", text: JSON.stringify(activities(days ?? 14)) }],
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
