"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DateSessionPicker() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv"));

  return (
    <div className="card flex items-center gap-2">
      <input
        type="date"
        className="input flex-1"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button
        className="btn shrink-0"
        onClick={() => date && router.push(`/gym/${date}`)}
      >
        Open →
      </button>
    </div>
  );
}
