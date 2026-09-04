"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { fetchTeams, fetchParticipantTotals, fetchAllCheckins, fetchAllSessions } from "@/lib/queries";
import { sortParticipants, teamById } from "@/lib/utils";
import { exportLeaderboardExcel, exportLeaderboardPdf } from "@/lib/export";
import { useStage } from "@/hooks/useStage";
import type { Team, ParticipantTotals, ActivityCheckin, ActivitySession } from "@/lib/types";

type SortKey = "total" | "name" | "team" | "attendance";

export default function LeaderboardPage() {
  const { stageKey } = useStage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rows, setRows] = useState<ParticipantTotals[]>([]);
  const [checkins, setCheckins] = useState<ActivityCheckin[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  async function load() {
    const stage = stageKey === "all" ? undefined : stageKey;
    const [t, r, c, s] = await Promise.all([
      fetchTeams(),
      fetchParticipantTotals(stage),
      fetchAllCheckins(),
      fetchAllSessions(),
    ]);
    setTeams(t);
    setRows(r);
    setCheckins(c);
    setSessions(s);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  // نسبة حضور كل فرد = عدد الجلسات اللي حضرها ÷ إجمالي عدد الجلسات اللي حصلت لحد دلوقتي × ١٠٠
  const totalSessions = useMemo(() => sessions.filter((s) => s.started_at).length, [sessions]);
  const attendancePctById = useMemo(() => {
    const sessionsByParticipant = new Map<string, Set<string>>();
    checkins.forEach((c) => {
      const set = sessionsByParticipant.get(c.participant_id) ?? new Set<string>();
      set.add(c.session_id);
      sessionsByParticipant.set(c.participant_id, set);
    });
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const attended = sessionsByParticipant.get(r.id)?.size ?? 0;
      map.set(r.id, totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0);
    });
    return map;
  }, [rows, checkins, totalSessions]);

  const filtered = useMemo(() => {
    let list = rows;
    if (query.trim()) list = list.filter((r) => r.name.includes(query.trim()));
    if (sortKey === "attendance") {
      const sorted = [...list].sort((a, b) => {
        const av = attendancePctById.get(a.id) ?? 0;
        const bv = attendancePctById.get(b.id) ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      });
      return sorted;
    }
    return sortParticipants(list, sortKey, sortDir, teams);
  }, [rows, query, sortKey, sortDir, teams, attendancePctById]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (loading) return <div className="text-textdim">جارِ التحميل…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">الترتيب العام الكامل</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportLeaderboardExcel(filtered, teams)}
            className="rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            تصدير Excel
          </button>
          <button
            onClick={() => exportLeaderboardPdf(filtered, teams)}
            className="rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            تصدير PDF
          </button>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="دور…"
        className="w-56 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface2">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-bold uppercase text-textdim">الترتيب</th>
              <th
                className="cursor-pointer px-4 py-3 text-start text-xs font-bold uppercase text-textdim"
                onClick={() => toggleSort("name")}
              >
                المشارك
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-start text-xs font-bold uppercase text-textdim"
                onClick={() => toggleSort("team")}
              >
                الفريق
              </th>
              <th className="px-4 py-3 text-start text-xs font-bold uppercase text-textdim">الحضور</th>
              <th
                className="cursor-pointer px-4 py-3 text-start text-xs font-bold uppercase text-textdim"
                onClick={() => toggleSort("attendance")}
              >
                نسبة الحضور
              </th>
              <th className="px-4 py-3 text-start text-xs font-bold uppercase text-textdim">إضافية</th>
              <th
                className="cursor-pointer px-4 py-3 text-start text-xs font-bold uppercase text-textdim"
                onClick={() => toggleSort("total")}
              >
                المجموع
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const team = teamById(teams, p.team_id);
              const pct = attendancePctById.get(p.id) ?? 0;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: team?.color ?? "#8B96AE" }}
                      />
                      {team?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{p.activity_points}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        pct >= 75 ? "bg-teal/15 text-teal" : pct >= 40 ? "bg-gold/15 text-gold" : "bg-coral/15 text-coral"
                      }`}
                    >
                      {pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{p.bonus_pts}</td>
                  <td className="px-4 py-2.5 font-bold">{p.total_points}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-textdim">
                  لا يوجد نتائج
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
