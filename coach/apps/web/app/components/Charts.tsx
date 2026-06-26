"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { stroke: "#8a99a8", fontSize: 11 };
const grid = "#222e3a";

function shortDate(d: string) {
  return d.slice(5); // MM-DD
}

export function SleepHrvChart({
  data,
}: {
  data: { date: string; sleep_h: number | null; hrv: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} axisLine={false} tickLine={false} />
        <YAxis yAxisId="l" tick={axis} axisLine={false} tickLine={false} />
        <YAxis yAxisId="r" orientation="right" tick={axis} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#141b24", border: "1px solid #222e3a", borderRadius: 12 }}
          labelStyle={{ color: "#8a99a8" }}
        />
        <Bar yAxisId="l" dataKey="sleep_h" name="Sleep (h)" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="r"
          type="monotone"
          dataKey="hrv"
          name="HRV (ms)"
          stroke="#38bdf8"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function LoadChart({ data }: { data: { date: string; load: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#141b24", border: "1px solid #222e3a", borderRadius: 12 }}
          labelStyle={{ color: "#8a99a8" }}
          cursor={{ fill: "#ffffff10" }}
        />
        <Bar dataKey="load" name="Training load" fill="#34d399" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
