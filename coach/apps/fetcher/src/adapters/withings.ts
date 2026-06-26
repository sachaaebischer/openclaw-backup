import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HealthDaily } from "@coach/lib";
import { trackerEnv } from "../credentials.js";
import { AdapterResult, RunOpts, emptyHealth } from "./types.js";

/**
 * Withings — direct OAuth2 REST API (body weight → health.weight_kg).
 * Ported from legacy sync-withings.py. Refresh tokens rotate on each use, so we
 * persist the new token back to ~/.withings_tokens.
 */
const TOKENS_FILE = path.join(os.homedir(), ".openclaw", "withings_tokens.json");

export async function fetchWithings(opts: RunOpts): Promise<AdapterResult> {
  const env = trackerEnv("withings");
  const clientId = env.WITHINGS_CLIENT_ID;
  const clientSecret = env.WITHINGS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("missing WITHINGS_CLIENT_ID/SECRET");

  let refreshToken = readTokens()?.refresh_token || env.WITHINGS_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("no Withings refresh token");

  const { access_token, refresh_token } = await refresh(clientId, clientSecret, refreshToken);
  writeTokens({ access_token, refresh_token });

  // Withings expects an epoch startdate/enddate range (the legacy `days=` param is invalid → 503).
  const startdate = Math.floor(+new Date(opts.since + "T00:00:00Z") / 1000);
  const enddate = Math.floor(+new Date(opts.until + "T23:59:59Z") / 1000);
  const res = await fetch("https://wbsapi.withings.net/v2/measure", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "getmeas",
      meastypes: "1",
      startdate: String(startdate),
      enddate: String(enddate),
    }),
  });
  const body: any = await res.json();
  if (body.status !== 0) throw new Error(`Withings API status ${body.status}`);

  const health: HealthDaily[] = [];
  for (const grp of body.body?.measuregrps ?? []) {
    const date = new Date(grp.date * 1000).toISOString().slice(0, 10);
    if (date < opts.since || date > opts.until) continue;
    const weight = (grp.measures ?? []).find((m: any) => m.type === 1);
    if (!weight) continue;
    const row = emptyHealth(date, "withings");
    row.weight_kg = Math.round(weight.value * Math.pow(10, weight.unit) * 100) / 100;
    health.push(row);
  }
  return { health, activities: [] };
}

async function refresh(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "requesttoken",
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const result: any = await res.json();
  if (result.status !== 0) throw new Error(`Withings token refresh failed: ${result.status}`);
  return {
    access_token: result.body.access_token as string,
    refresh_token: (result.body.refresh_token as string) || refreshToken,
  };
}

function readTokens(): { access_token?: string; refresh_token?: string } | null {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeTokens(t: { access_token: string; refresh_token: string }) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2));
  fs.chmodSync(TOKENS_FILE, 0o600);
}
