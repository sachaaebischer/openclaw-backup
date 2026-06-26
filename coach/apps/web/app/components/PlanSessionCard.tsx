'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { PlannedSession } from '@coach/lib';

const intensityColor: Record<string, string> = {
  hard: 'bg-bad/20 text-bad',
  moderate: 'bg-warn/20 text-warn',
  easy: 'bg-good/20 text-good',
};

const typeIcon: Record<string, string> = {
  gym: '🏋️',
  floorball: '🏑',
  bike: '🚴',
  cycling: '🚴',
  run: '🏃',
  running: '🏃',
  rest: '😴',
};

export function PlanSessionCard({
  session,
  gymDate,
}: {
  session: PlannedSession;
  gymDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!session.details;

  const header = (
    <div className="flex items-start gap-2">
      <span>{typeIcon[session.type] ?? '•'}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{session.title}</div>
        <div className="text-xs text-muted">
          {session.planned_at ? `${session.planned_at} · ` : ''}
          {session.duration_min ? `${session.duration_min} min` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {session.intensity && (
          <span
            className={`pill ${intensityColor[session.intensity] ?? 'bg-cardborder text-muted'}`}
          >
            {session.intensity}
          </span>
        )}
        {hasDetails && !gymDate && (
          <span className="text-xs text-muted">{open ? '▲' : '▼'}</span>
        )}
      </div>
    </div>
  );

  if (gymDate) {
    return (
      <Link href={gymDate} className="block rounded-lg p-1 hover:bg-white/5">
        {header}
      </Link>
    );
  }

  return (
    <div
      className={`rounded-lg p-1 ${hasDetails ? 'cursor-pointer hover:bg-white/5' : ''}`}
      onClick={() => hasDetails && setOpen((o) => !o)}
    >
      {header}
      {open && (
        <p className="mt-2 border-t border-cardborder/50 pt-2 text-xs leading-relaxed text-muted">
          {session.details}
        </p>
      )}
    </div>
  );
}
