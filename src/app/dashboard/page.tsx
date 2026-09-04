"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import ProgressRing from "@/components/charts/ProgressRing";
import BarChart from "@/components/charts/BarChart";
import PieChart from "@/components/charts/PieChart";
import Podium from "@/components/charts/Podium";
import { fetchTeams, fetchParticipantTotals, fetchActivities, fetchAllCheckins, fetchAllSessions, fetchTodayBonusLog } from "@/lib/queries";
import { teamById, STAGE_LABELS } from "@/lib/utils";
import type { Team, ParticipantTotals, Activity, ActivityCheckin, ActivitySession, BonusLogEntry, Stage } from "@/lib/types";

const STAGES: Stage[] = ["elementary", "preparatory", "secondary", "university"];

export default function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allRows, setAllRows] = useState<ParticipantTotals[]>([]); // كل المشاركين من كل المراحل
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checkins, setCheckins] = useState<ActivityCheckin[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [todayBonus, setTodayBonus] = useState<BonusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // المرحلة اللي بتدور عليها كارت "أعلى مشارك" والبوديوم — بتتغير لوحدها كل ٥ ثواني
  // بغض النظر عن المرحلة المختارة فوق (بالظبط زي الأصل)
  const [rotateStage, setRotateStage] = useState<Stage>("elementary");

  const load = useCallback(async () => {
    const [t, all, a, c, s, b] = await Promise.all([
      fetchTeams(),
      fetchParticipantTotals(), // بدون فلترة — التارجت وترتيب الفرق بيحسبوا من كل المراحل مع بعض دايمًا
      fetchActivities(false),
      fetchAllCheckins(),
      fetchAllSessions(),
      fetchTodayBonusLog(),
    ]);
    setTeams(t);
    setAllRows(all);
    setActivities(a);
    setCheckins(c);
    setSessions(s);
    setTodayBonus(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // بيتحدث ويدور على المرحلة الجاية كل ٥ ثواني — بالظبط زي الأصل
  useEffect(() => {
    const id = setInterval(() => {
      load();
      setRotateStage((prev) => {
        const idx = STAGES.indexOf(prev);
        return STAGES[(idx + 1) % STAGES.length];
      });
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  // ترتيب الفرق: بيجمع كل المراحل مع بعض دايمًا لأن الفريق كيان عام مش تابع لمرحلة واحدة
  const teamStandings = useMemo(() => {
    return teams
      .map((team) => {
        const members = allRows.filter((r) => r.team_id === team.id);
        const membersTotal = members.reduce((s, m) => s + m.total_points, 0);
        const total = membersTotal + (team.bonus_pts ?? 0);
        return { team, total, count: members.length };
      })
      .sort((a, b) => b.total - a.total);
  }, [teams, allRows]);

  const leadingTeam = teamStandings[0];

  // أعلى مشارك — من المرحلة الدايرة عليها بس
  const rotateScope = useMemo(() => allRows.filter((r) => r.stage === rotateStage), [allRows, rotateStage]);

  // التارجت: مجموع (النقطة الأساسية + نقطة المكافأة) لكل الأنشطة المتاحة = أقصى نقاط ممكن الفرد ياخدها
  const targetGoal = useMemo(() => {
    const maxTarget = activities.reduce((s, a) => s + a.base_points + a.bonus_points, 0);
    const n = allRows.length;
    const achievedCount = maxTarget > 0 && n > 0 ? allRows.filter((r) => r.total_points >= maxTarget).length : 0;
    const pct = n > 0 ? Math.round((achievedCount / n) * 100) : 0;
    return { maxTarget, n, achievedCount, pct };
  }, [activities, allRows]);

  // الحصان الأسود: الفريق اللي جمع أكتر نقط النهاردة (من الأنشطة + البونص الإضافي مع بعض)
  const darkHorse = useMemo(() => {
    const byTeam = new Map<string, number>();

    // نقط الأنشطة اللي حصلت في جلسات النهاردة بس
    const todaySessionIds = new Set(sessions.filter((s) => s.session_date === today).map((s) => s.id));
    checkins
      .filter((c) => todaySessionIds.has(c.session_id))
      .forEach((c) => {
        const p = allRows.find((r) => r.id === c.participant_id);
        if (!p?.team_id) return;
        byTeam.set(p.team_id, (byTeam.get(p.team_id) ?? 0) + c.points);
      });

    // البونص الإضافي المسجل النهاردة
    todayBonus.forEach((entry) => {
      let teamId = entry.team_id;
      if (!teamId && entry.participant_id) {
        const p = allRows.find((r) => r.id === entry.participant_id);
        teamId = p?.team_id ?? null;
      }
      if (!teamId) return;
      byTeam.set(teamId, (byTeam.get(teamId) ?? 0) + entry.points);
    });

    if (byTeam.size === 0) return null;
    const [teamId, gained] = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0];
    if (gained <= 0) return null;
    return { team: teamById(teams, teamId), gained };
  }, [todayBonus, allRows, teams, checkins, sessions, today]);

  // الجلسة الحالية: آخر واحدة اتفتحت النهاردة ولسه شغالة (مقفلتش). لو مفيش حاجة شغالة النهاردة،
  // بنرجع لآخر جلسة اتفتحت عمومًا (حتى لو يوم فات) عشان الشاشة متفضلش فاضية.
  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const byStartedAtDesc = (a: ActivitySession, b: ActivitySession) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : new Date(a.created_at).getTime();
      const bTime = b.started_at ? new Date(b.started_at).getTime() : new Date(b.created_at).getTime();
      return bTime - aTime;
    };
    const openToday = sessions.filter((s) => s.session_date === today && !s.locked && s.started_at);
    if (openToday.length > 0) {
      return [...openToday].sort(byStartedAtDesc)[0];
    }
    // مفيش حاجة شغالة النهاردة — ناخد آخر جلسة اتبدأت عمومًا (حتى لو مقفولة)
    const anyStarted = sessions.filter((s) => s.started_at);
    const pool = anyStarted.length > 0 ? anyStarted : sessions;
    return [...pool].sort(byStartedAtDesc)[0] ?? null;
  }, [sessions]);

  // فلتر مرحلة محلي بس لكارت "تحليل حضور النشاط الحالي" — مستقل عن باقي الداشبورد
  const [pieStage, setPieStage] = useState<Stage | "all">("all");

  // تحليل حضور الأنشطة: بيرسون واحد بس — بتاع الجلسة الحالية بالظبط (مش كل تاريخ النشاط ده مجمّع مع بعض)
  const arrivalPies = useMemo(() => {
    if (!currentSession) return [];
    const activity = activities.find((a) => a.key === currentSession.activity_key);
    if (!activity) return [];
    const scopedRows = pieStage === "all" ? allRows : allRows.filter((r) => r.stage === pieStage);
    const rows = teams
      .map((team) => {
        const members = scopedRows.filter((r) => r.team_id === team.id);
        const memberIds = new Set(members.map((m) => m.id));
        // بس اللي حضروا في الجلسة الحالية بالظبط (session_id) وقت ما التايمر كان شغال (is_bonus)
        const checkedIn = new Set(
          checkins
            .filter((c) => c.session_id === currentSession.id && c.is_bonus && memberIds.has(c.participant_id))
            .map((c) => c.participant_id)
        ).size;
        return { name: team.name, color: team.color, value: checkedIn, size: members.length };
      })
      .filter((r) => r.size > 0);
    return [{ activity, rows }];
  }, [currentSession, activities, teams, allRows, checkins, pieStage]);

  if (loading) return <div className="text-textdim">جارِ التحميل…</div>;

  if (allRows.length === 0) {
    return (
      <Card className="py-16 text-center">
        <p className="font-bold">لسه مفيش مشاركين مُضافين</p>
        <p className="mt-2 text-sm text-textdim">ضيف مشاركين من صفحة الإعدادات عشان تبدأ.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-textdim">
        <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
        بيتحدث أوتوماتيك كل ٥ ثواني
      </div>

      {/* ============ KPI grid: الفريق الأول · الحصان الأسود · التارجت ============ */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-textdim">الفريق الأول</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral/15 text-coral">♛</span>
          </div>
          {leadingTeam && leadingTeam.total > 0 ? (
            <>
              <div className="flex items-center gap-2 font-display text-xl font-extrabold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: leadingTeam.team.color }} />
                {leadingTeam.team.name}
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold" style={{ color: leadingTeam.team.color }}>
                {leadingTeam.total} <span className="text-xs font-semibold text-textdim">نقطة</span>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-textdim">لسه مفيش نقط</p>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-textdim">الحصان الأسود</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral/15 text-coral">🔥</span>
          </div>
          {darkHorse?.team ? (
            <>
              <div className="flex items-center gap-2 font-display text-xl font-extrabold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: darkHorse.team.color }} />
                {darkHorse.team.name}
              </div>
              <p className="mt-2 text-xs text-textdim">جمع +{darkHorse.gained} نقطة إضافية النهاردة</p>
            </>
          ) : (
            <p className="mt-6 text-sm text-textdim">بنجمع بيانات الجلسات…</p>
          )}
        </Card>

        <Card className="flex flex-col items-center text-center">
          <div className="mb-1 flex w-full items-center justify-between">
            <span className="text-sm font-bold text-textdim">التارجت</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold">★</span>
          </div>
          <div className="relative my-3 flex items-center justify-center">
            <ProgressRing pct={targetGoal.pct} size={126} />
            <div className="absolute flex flex-col items-center">
              <span className="font-display text-2xl font-extrabold text-gold">{targetGoal.pct}%</span>
              <span className="text-[11px] font-bold text-textdim">
                {targetGoal.achievedCount}/{targetGoal.n}
              </span>
            </div>
          </div>
          <p className="max-w-[220px] text-xs leading-relaxed text-textdim">نسبة الأفراد الذين حققوا التارجت أو أعلى</p>
          <span className="mt-2.5 rounded-full bg-track px-3.5 py-1.5 text-xs font-bold">
            التارجت الكامل للمؤتمر: {targetGoal.maxTarget} نقطة
          </span>
        </Card>
      </div>

      {/* ============ ترتيب الفرق (بار تشارت) — أكبر عنصر في الصفحة ============ */}
      <Card>
        <h2 className="mb-1 font-display text-lg font-bold">ترتيب الفرق</h2>
        <p className="mb-4 text-xs text-textdim">إجمالي النقاط لكل فريق، بيتحدث لحظيًا</p>
        {teamStandings.length > 0 ? (
          <div className="h-80 sm:h-96">
            <BarChart
              labels={teamStandings.map((s) => s.team.name)}
              values={teamStandings.map((s) => s.total)}
              colors={teamStandings.map((s) => s.team.color)}
            />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-textdim">مفيش فرق لسه</p>
        )}
      </Card>

      {/* ============ تحليل حضور النشاط الحالي (بيرسون أصغر) + البوديوم (أفضل ٥) ============ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">تحليل حضور النشاط الحالي</h2>
              <p className="text-xs text-textdim">النشاط اللي لسه شغال دلوقتي — أو آخر نشاط اتسجل فيه حضور</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border p-1">
              {(
                [
                  { key: "all", label: "كل المراحل" },
                  { key: "elementary", label: "ابتدائي" },
                  { key: "preparatory", label: "إعدادي" },
                  { key: "secondary", label: "ثانوي" },
                ] as { key: Stage | "all"; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPieStage(opt.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                    pieStage === opt.key ? "bg-gold text-[#241A03]" : "text-textdim"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            {arrivalPies.map(({ activity, rows }) => (
              <div key={activity.key} className="w-full max-w-[170px] text-center">
                <div className="mb-2 text-sm font-bold">{activity.name}</div>
                {rows.length > 0 ? (
                  <PieChart labels={rows.map((r) => r.name)} values={rows.map((r) => r.value)} colors={rows.map((r) => r.color)} />
                ) : (
                  <p className="py-4 text-[11px] text-textdim">لا بيانات للمرحلة دي</p>
                )}
              </div>
            ))}
            {arrivalPies.length === 0 && <p className="py-6 text-center text-sm text-textdim">لسه محدش بدأ أي جلسة حضور</p>}
          </div>
        </Card>

        <Card>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">أفضل خمسة</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-teal/15 px-2.5 py-1 text-[11px] font-bold text-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" /> لايف
            </span>
          </div>
          <span className="mb-1.5 inline-block rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
            ★ بيعرض: {STAGE_LABELS[rotateStage]}
          </span>
          <Podium rows={rotateScope} teams={teams} />
        </Card>
      </div>
    </div>
  );
}
