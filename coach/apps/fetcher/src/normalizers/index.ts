import { Activity, HealthDaily } from "@coach/lib";
import { normalizeActivities, normalizeHealth } from "./generic.js";

export interface Normalizer {
  health?: (raw: unknown, source: string) => HealthDaily[];
  activities?: (raw: unknown, source: string) => Activity[];
}

/**
 * Per-source normalizer overrides. Anything not listed here falls back to the
 * generic best-effort mapper. Add an entry when a real tracker's output needs
 * custom handling (inspect data/raw/<source>/ to see its shape).
 */
const overrides: Record<string, Normalizer> = {
  // polar: { health: ..., activities: ... },
};

const generic: Required<Normalizer> = {
  health: normalizeHealth,
  activities: normalizeActivities,
};

export function getNormalizer(source: string): Required<Normalizer> {
  const o = overrides[source];
  return {
    health: o?.health ?? generic.health,
    activities: o?.activities ?? generic.activities,
  };
}
