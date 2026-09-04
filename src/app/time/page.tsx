"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import {
  fetchActivities,
  fetchParticipants,
  fetchOpenSession,
  fetchTodaySessions,
  startNewSession,
  lockSession,
  fetchCheckinsForSession,
  checkInParticipant,
  undoCheckin,
} from "@/lib/queries";
import { useToast } from "@/hooks/useToast";
import { useStage, STAGE_OPTIONS } from "@/hooks/useStage";
import type { Activity, Participant, ActivityCheckin, ActivitySession } from "@/lib/types";

export default function TimePage() {
  const { toast } = useToast();
  const { stageKey } = useStage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groupName, setGroupName] = useState<string>("");
  const [activityKey, setActivityKey] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [checkins, setCheckins] = useState<ActivityCheckin[]>([]);
  const [session, setSession] = useState<ActivitySession | null>(null);
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stageKey === "all") {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [a, p] = await Promise.all([fetchActivities(false), fetchParticipants(stageKey)]);
      setActivities(a);
      setParticipants(p);
      if (a[0]) {
        setGroupName(a[0].group_name);
        setActivityKey(a[0].key);
      }
      setLoading(false);
    })();
  }, [stageKey]);

  // مجموعات الأنشطة (مثلاً: قداس، عشية، تسبحة، كلمة سيدنا، حصة، ورشة)
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    activities.forEach((a) => {
      if (!seen.has(a.group_name)) {
        seen.add(a.group_name);
        list.push(a.group_name);
      }
    });
    return list;
  }, [activities]);

  const activitiesInGroup = useMemo(
    () => activities.filter((a) => a.group_name === groupName),
    [activities, groupName]
  );

  function handleSelectGroup(g: string) {
    setGroupName(g);
    const first = activities.find((a) => a.group_name === g);
    if (first) setActivityKey(first.key);
  }

  const loadSessionState = useCallback(async () => {
    if (!activityKey) return;
    const open = await fetchOpenSession(activityKey);
    setSession(open);
    if (open) {
      setDuration(open.duration_minutes);
      setCheckins(await fetchCheckinsForSession(open.id));
    } else {
      setCheckins([]);
    }
  }, [activityKey]);

  useEffect(() => {
    loadSessionState();
  }, [loadSessionState]);

  // ساعة بتتحدث كل ثانية عشان العداد التنازلي يبقى حي
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activity = activities.find((a) => a.key === activityKey);
  const checkedIds = useMemo(() => new Set(checkins.map((c) => c.participant_id)), [checkins]);

  const remainingSeconds = useMemo(() => {
    if (!session?.started_at) return null;
    const windowMs = (session.duration_minutes ?? duration) * 60000;
    const endsAt = new Date(session.started_at).getTime() + windowMs;
    return Math.max(0, Math.round((endsAt - now) / 1000));
  }, [session, duration, now]);

  const withinBonusWindow = remainingSeconds !== null && remainingSeconds > 0;

  const remainingLabel = useMemo(() => {
    if (remainingSeconds === null) return "";
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [remainingSeconds]);

  async function handleStart() {
    if (!activity) return;
    // لو فيه جلسة اتعملت للنشاط ده النهاردة (حتى لو مقفولة)، نوضح ده صريح قبل ما نعمل جلسة جديدة منفصلة
    const todaySessions = await fetchTodaySessions(activityKey);
    if (todaySessions.length > 0) {
      const ok = confirm(
        `فيه جلسة اتعملت بالفعل للنشاط ده النهاردة (${todaySessions.length}). لو كملت، هتتعمل جلسة تانية منفصلة لنفس اليوم — البيانات مش هتتلخبط، بس خد بالك تفرّق بينهم صح لما تيجي تمسح أي جلسة بعدين. عايز تكمل؟`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await startNewSession(activityKey, duration, activity.bonus_points);
      await loadSessionState();
      toast("اتفتحت جلسة النهاردة", "success");
    } finally {
      setBusy(false);
    }
  }

  async function handleLock() {
    if (!session) return;
    if (!confirm("هتقفل جلسة النهاردة؟ مش هتقدر تسجل حضور فيها تاني إلا لو فتحتها تاني.")) return;
    setBusy(true);
    try {
      await lockSession(session.id);
      await loadSessionState();
      toast("اتقفلت الجلسة", "info");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckIn(p: Participant) {
    if (!activity || !session) return;
    const isBonus = withinBonusWindow;
    const earned = isBonus ? session.points ?? activity.bonus_points : activity.base_points;
    await checkInParticipant(p.id, session.id, activity.key, earned, isBonus);
    setCheckins(await fetchCheckinsForSession(session.id));
    toast(isBonus ? "مكافأة! ✨" : "أساسي", "success");
  }

  async function handleUndo(p: Participant) {
    if (!session) return;
    await undoCheckin(p.id, session.id);
    setCheckins(await fetchCheckinsForSession(session.id));
    toast("إلغاء", "info");
  }

  if (loading) return <div className="text-textdim">جارِ التحميل…</div>;

  if (stageKey === "all") {
    return (
      <Card className="py-16 text-center">
        <p className="font-bold">اختار مرحلة معينة من الشريط فوق عشان تستخدم الصفحة دي.</p>
        <p className="mt-2 text-sm text-textdim">
          {STAGE_OPTIONS.filter((s) => s.key !== "all").map((s) => s.label).join(" · ")}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">الحضور</h1>
        <p className="mt-1 text-sm text-textdim">
          كل نشاط بيبقى ليه جلسة جديدة أوتوماتيك كل يوم — النهاردة، بكرة، بعد بكرة. دوس &quot;ابدأ اليوم&quot;،
          حدد مدة النافذة وقيمة النقاط، سجّل الحضور، وممكن تقفل الجلسة قبل ما اليوم يخلص لو حبيت.
        </p>
      </div>

      {/* المستوى الأول: مجموعات الأنشطة */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-1">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => handleSelectGroup(g)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${
              groupName === g ? "bg-gold text-[#241A03]" : "text-textdim"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* المستوى الثاني: الأنشطة جوه المجموعة، لو أكتر من واحد (زي حصة ١/٢/٣) */}
      {activitiesInGroup.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-1">
          {activitiesInGroup.map((a) => (
            <button
              key={a.key}
              onClick={() => setActivityKey(a.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                activityKey === a.key ? "bg-teal/20 text-teal" : "text-textdim"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {activity && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            {!session ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold text-textdim">مدة النافذة (دقيقة)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-28 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  disabled={busy}
                  onClick={handleStart}
                  className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03] disabled:opacity-50"
                >
                  ابدأ اليوم
                </button>
                <button
                  onClick={() => loadSessionState()}
                  title="تحديث"
                  className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-textdim"
                >
                  🔄 تحديث
                </button>
              </>
            ) : (
              <>
                <span className="rounded-full bg-teal/15 px-3 py-1.5 text-xs font-bold text-teal">
                  جلسة النهاردة شغالة
                </span>
                {withinBonusWindow ? (
                  <span className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold">
                    ⏱️ متبقي {remainingLabel} — نقطة {session.points ?? activity.bonus_points}
                  </span>
                ) : (
                  <span className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-textdim">
                    النافذة قفلت — النقطة الافتراضية ({activity.base_points}) دلوقتي
                  </span>
                )}
                <button
                  disabled={busy}
                  onClick={handleLock}
                  className="rounded-xl border border-coral px-4 py-2 text-sm font-bold text-coral disabled:opacity-50"
                >
                  اقفل الجلسة
                </button>
                <button
                  onClick={() => loadSessionState()}
                  title="تحديث"
                  className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-textdim"
                >
                  🔄 تحديث
                </button>
              </>
            )}
          </div>
        </Card>
      )}

      <Card>
        {!session ? (
          <p className="py-10 text-center text-sm text-textdim">
            لسه ما بدأتش النهاردة للنشاط ده — دوس &quot;ابدأ اليوم&quot; فوق عشان تقدر تسجل حضور.
          </p>
        ) : (
          <div className="flex flex-col">
            {participants.map((p) => {
              const done = checkedIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between border-t border-border py-2.5 first:border-none">
                  <span className="text-sm">{p.name}</span>
                  {done ? (
                    <button onClick={() => handleUndo(p)} className="rounded-lg border border-coral px-3 py-1.5 text-xs font-semibold text-coral">
                      إلغاء
                    </button>
                  ) : (
                    <button onClick={() => handleCheckIn(p)} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-[#241A03]">
                      سجّل حضور
                    </button>
                  )}
                </div>
              );
            })}
            {participants.length === 0 && <div className="py-6 text-center text-sm text-textdim">مفيش مشاركين</div>}
          </div>
        )}
      </Card>
    </div>
  );
}
