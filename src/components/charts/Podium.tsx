"use client";

import type { ParticipantTotals, Team } from "@/lib/types";
import { teamById } from "@/lib/utils";

interface PodiumEntry {
  row: ParticipantTotals;
  rank: number;
}

export default function Podium({ rows, teams }: { rows: ParticipantTotals[]; teams: Team[] }) {
  const top5 = [...rows].sort((a, b) => b.total_points - a.total_points).slice(0, 5);
  const heights = [70, 50, 100, 38, 30]; // نفس نسب الأصل: التالت أطول عمود (رقم ١)، بعدين التاني، بعدين الأول
  const order = [2, 1, 0, 3, 4]; // رقم ١ في النص، رقم ٢ يمين، رقم ٣ شمال (زي البوديوم الحقيقي)

  if (top5.length === 0) {
    return <p className="py-8 text-center text-sm text-textdim">لسه مفيش مشاركين للمرحلة دي</p>;
  }

  return (
    <div className="flex h-56 items-end justify-center gap-2">
      {order
        .filter((i) => i < top5.length)
        .map((i) => {
          const row = top5[i];
          const rank = i + 1;
          const isFirst = rank === 1;
          const team = teamById(teams, row.team_id);
          const medal = rank === 1 ? "#F2B84B" : rank === 2 ? "#C4CCD8" : rank === 3 ? "#CD8A5C" : "#8B96AE";
          return (
            <div key={row.id} className="flex max-w-[110px] flex-1 flex-col items-center">
              <div
                className="mb-1.5 flex items-center justify-center rounded-full border-2 font-extrabold"
                style={{
                  width: isFirst ? 44 : 32,
                  height: isFirst ? 44 : 32,
                  fontSize: isFirst ? 16 : 12,
                  borderColor: medal,
                  color: medal,
                  background: isFirst ? "#F2B84B22" : "transparent",
                }}
              >
                {rank}
              </div>
              <div className="w-full truncate text-center text-xs font-bold">{row.name}</div>
              <div className="mb-1.5 w-full truncate text-center text-[10px] text-textdim">{team?.name ?? "—"}</div>
              <div
                className="flex w-full items-start justify-center rounded-t-lg pt-2"
                style={{
                  height: `${heights[i]}%`,
                  background: isFirst ? "linear-gradient(180deg, #F2B84B, #F2B84B99)" : "var(--track)",
                  boxShadow: isFirst ? "0 0 24px #F2B84B55" : "none",
                }}
              >
                <span className="text-xs font-extrabold" style={{ color: isFirst ? "#3A2A05" : "var(--text)" }}>
                  {row.total_points}
                </span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
