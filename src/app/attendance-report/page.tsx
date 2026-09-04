"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import ProgressRing from "@/components/charts/ProgressRing";
import PasswordGate from "@/components/auth/PasswordGate";
import { useStage } from "@/hooks/useStage";
import { fetchTeams, fetchParticipantTotals, fetchActivities, fetchAllCheckins, fetchAllSessions, deleteSession } from "@/lib/queries";
import { useToast } from "@/hooks/useToast";
import type { Team, ParticipantTotals, Activity, ActivityCheckin, ActivitySession } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" });
}

/** لو فيه أكتر من جلسة في نفس التاريخ (زي جلسة اتعملت من صفحة تانية بالغلط)، بنوضح رقم الجلسة
 * عشان تقدر تفرّق بينهم بسهولة قبل ما تمسح أي حاجة */
function dayLabel(session: ActivitySession, isToday: boolean, allDaysSameActivity: { session: ActivitySession }[]) {
  const base = isToday ? "النهاردة" : formatDate(session.session_date);
  const sameDateCount = allDaysSameActivity.filter((d) => d.session.session_date === session.session_date).length;
  return sameDateCount > 1 ? `${base} (جلسة ${session.session_no})` : base;
}

export default function AttendanceReportPage() {
  return (
    <PasswordGate storageKey="unlocked_attendance_report">
      <AttendanceReportContent />
    </PasswordGate>
  );
}

function AttendanceReportContent() {
  const { stageKey } = useStage();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rows, setRows] = useState<ParticipantTotals[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checkins, setCheckins] = useState<ActivityCheckin[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNames, setShowNames] = useState<Record<string, boolean>>({});
  // اليوم المختار حاليًا لكل نشاط — عشان نعرض يوم واحد بس بدل ما الصفحة تكبر مع الوقت
  const [selectedDay, setSelectedDay] = useState<Record<string, string>>({});

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const stage = stageKey === "all" ? undefined : stageKey;
    const [tm, r, a, c, s] = await Promise.all([
      fetchTeams(),
      fetchParticipantTotals(stage),
      fetchActivities(false),
      fetchAllCheckins(),
      fetchAllSessions(),
    ]);
    setTeams(tm);
    setRows(r);
    setActivities(a);
    setCheckins(c);
    setSessions(s);
    setLoading(false);
  }, [stageKey]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // بيتحدث أوتوماتيك كل ٥ ثواني
  useEffect(() => {
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const scopedIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  // بيانات كل يوم (جلسة) لكل نشاط — مش كل الأيام مجمّعة مع بعض
  const activitySessionCards = useMemo(() => {
    return activities.map((activity) => {
      const activitySessions = sessions
        .filter((s) => s.activity_key === activity.key)
        .sort((a, b) => (a.session_date < b.session_date ? 1 : -1));

      const days = activitySessions.map((session) => {
        const sessionCheckins = checkins.filter((c) => c.session_id === session.id && scopedIds.has(c.participant_id));
        const presentIds = new Set(sessionCheckins.map((c) => c.participant_id));
        const earlyNames = sessionCheckins.filter((c) => c.is_bonus).map((c) => rows.find((r) => r.id === c.participant_id)?.name ?? "؟");
        const lateNames = sessionCheckins.filter((c) => !c.is_bonus).map((c) => rows.find((r) => r.id === c.participant_id)?.name ?? "؟");
        const absentNames = rows.filter((r) => !presentIds.has(r.id)).map((r) => r.name);
        const pct = rows.length ? Math.round((presentIds.size / rows.length) * 100) : 0;
        const byTeam = teams
          .map((team) => {
            const members = rows.filter((r) => r.team_id === team.id);
            const present = members.filter((m) => presentIds.has(m.id)).length;
            return { team, present, total: members.length };
          })
          .filter((t) => t.total > 0);
        return {
          session,
          isToday: session.session_date === today,
          presentCount: presentIds.size,
          total: rows.length,
          pct,
          earlyNames,
          lateNames,
          absentNames,
          byTeam,
        };
      });

      return { activity, days };
    });
  }, [activities, sessions, checkins, rows, scopedIds, today, teams]);

  const activityGroups = useMemo(() => {
    const map = new Map<string, typeof activitySessionCards>();
    activitySessionCards.forEach((item) => {
      const list = map.get(item.activity.group_name) ?? [];
      list.push(item);
      map.set(item.activity.group_name, list);
    });
    return Array.from(map.entries());
  }, [activitySessionCards]);

  if (loading) return <div className="text-textdim">جارِ التحميل…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">تحليل الحضور</h1>
          <p className="mt-1 text-sm text-textdim">
            اختار المرحلة من الشريط فوق، واختار اليوم اللي عايز تشوفه لكل نشاط
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-textdim">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
          بيتحدث أوتوماتيك كل ٥ ثواني
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {activityGroups.map(([group, activityList]) => (
          <Card key={group}>
            <div className="mb-4 text-xs font-bold text-gold">{group}</div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activityList.map(({ activity, days }) => {
                if (days.length === 0) {
                  return (
                    <div key={activity.key} className="rounded-xl border border-border p-3.5 text-center">
                      <div className="mb-2 text-sm font-bold">{activity.name}</div>
                      <p className="text-xs text-textdim">لسه معملتش جلسة للنشاط ده</p>
                    </div>
                  );
                }

                const currentDayId = selectedDay[activity.key] ?? days[0].session.id;
                const current = days.find((d) => d.session.id === currentDayId) ?? days[0];
                const namesKey = current.session.id;
                const isOpen = !!showNames[namesKey];

                return (
                  <div key={activity.key} className="rounded-xl border border-border p-3.5">
                    <div className="mb-2 text-center text-sm font-bold">{activity.name}</div>

                    {/* اختيار اليوم — تابات صغيرة قابلة للف، بدل ما كل الأيام تتعرض مع بعض */}
                    {days.length > 1 && (
                      <div className="mb-3 flex flex-wrap justify-center gap-1">
                        {days.map(({ session, isToday }) => (
                          <span
                            key={session.id}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              currentDayId === session.id ? "bg-gold text-[#241A03]" : "bg-surface2 text-textdim"
                            }`}
                          >
                            <button onClick={() => setSelectedDay((prev) => ({ ...prev, [activity.key]: session.id }))}>
                              {dayLabel(session, isToday, days)}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm("تمسح الجلسة دي نهائيًا؟ هيتمسح معاها كل تسجيلات الحضور بتاعتها.")) return;
                                await deleteSession(session.id);
                                toast("اتمسحت الجلسة", "info");
                                load();
                              }}
                              title="امسح الجلسة دي"
                              className="text-coral"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* لو يوم واحد بس، ظهّر زرار المسح جنب اسم النشاط */}
                    {days.length === 1 && (
                      <div className="mb-2 flex justify-center">
                        <button
                          onClick={async () => {
                            if (!confirm("تمسح الجلسة دي نهائيًا؟ هيتمسح معاها كل تسجيلات الحضور بتاعتها.")) return;
                            await deleteSession(current.session.id);
                            toast("اتمسحت الجلسة", "info");
                            load();
                          }}
                          className="text-[10px] font-bold text-coral underline"
                        >
                          امسح الجلسة دي
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col items-center">
                      <span className="mb-1.5 text-[11px] font-bold text-textdim">
                        {current.isToday ? "النهاردة" : formatDate(current.session.session_date)}
                        {!current.session.locked && current.isToday && <span className="ms-1.5 text-teal">●</span>}
                      </span>
                      <div className="relative flex items-center justify-center">
                        <ProgressRing pct={current.pct} size={100} />
                        <div className="absolute flex flex-col items-center">
                          <span className="font-display text-base font-extrabold">{current.pct}%</span>
                          <span className="text-[11px] text-textdim">
                            {current.presentCount}/{current.total}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex w-full flex-wrap justify-center gap-1.5">
                        {current.byTeam.map(({ team, present, total: teamTotal }) => (
                          <span
                            key={team.id}
                            className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-1 text-[10px] font-bold"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: team.color }} />
                            {team.name}: {present}/{teamTotal}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => setShowNames((prev) => ({ ...prev, [namesKey]: !prev[namesKey] }))}
                        className="mt-2 text-[11px] text-textdim underline"
                      >
                        {isOpen ? "اقفل التفاصيل" : "شوف الأسماء"}
                      </button>

                      {isOpen && (
                        <div className="mt-3 w-full space-y-2 rounded-xl border border-border bg-surface2 p-3 text-start">
                          <div>
                            <div className="text-[11px] font-bold text-teal">حضروا بدري ({current.earlyNames.length})</div>
                            <div className="mt-1 text-xs text-textdim">{current.earlyNames.length ? current.earlyNames.join("، ") : "—"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-gold">جم متأخرين ({current.lateNames.length})</div>
                            <div className="mt-1 text-xs text-textdim">{current.lateNames.length ? current.lateNames.join("، ") : "—"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-coral">غايبين ({current.absentNames.length})</div>
                            <div className="mt-1 text-xs text-textdim">{current.absentNames.length ? current.absentNames.join("، ") : "—"}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
        {activityGroups.length === 0 && (
          <Card className="py-16 text-center text-sm text-textdim">لسه معملتش تسجيل حضور</Card>
        )}
      </div>
    </div>
  );
}
