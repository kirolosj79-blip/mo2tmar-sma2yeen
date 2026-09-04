import type { Participant, ParticipantTotals, Team } from "@/lib/types";

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function teamById(teams: Team[], id: string | null) {
  return teams.find((t) => t.id === id) ?? null;
}

export function totalScore(p: ParticipantTotals) {
  return p.total_points;
}

export function sortParticipants(
  rows: ParticipantTotals[],
  key: "total" | "name" | "team",
  dir: "asc" | "desc",
  teams: Team[]
) {
  const sorted = [...rows].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    if (key === "total") {
      av = a.total_points;
      bv = b.total_points;
    } else if (key === "name") {
      av = a.name;
      bv = b.name;
    } else if (key === "team") {
      av = teamById(teams, a.team_id)?.name ?? "";
      bv = teamById(teams, b.team_id)?.name ?? "";
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

export const TEAM_COLOR_CHOICES = [
  "#EF4444",
  "#F2B84B",
  "#60A5FA",
  "#34D399",
  "#A78BFA",
  "#F472B6",
  "#FB923C",
  "#22D3EE",
];

export const STAGE_LABELS: Record<string, string> = {
  elementary: "ابتدائي",
  preparatory: "إعدادي",
  secondary: "ثانوي",
  university: "جامعة",
  all: "كل المراحل",
};
