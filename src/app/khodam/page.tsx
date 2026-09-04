"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import PasswordGate from "@/components/auth/PasswordGate";
import {
  fetchKhodam,
  createKhadem,
  renameKhadem,
  deleteKhadem,
  fetchActivities,
  fetchAllKhodamSessions,
  fetchAllKhodamCheckins,
  fetchKhodamOpenSession,
  startKhodamSession,
  lockKhodamSession,
  deleteKhodamSession,
  checkInKhadem,
  undoKhademCheckin,
  fetchKhodamCheckinsForSession,
} from "@/lib/queries";
import { exportTableExcel, exportTablePdf } from "@/lib/export";
import { useToast } from "@/hooks/useToast";
import type { Khadem, Activity, KhademSession, KhademCheckin } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" });
}

/** لو فيه أكتر من جلسة في نفس التاريخ، بنوضح رقم الجلسة عشان تقدر تفرّق بينهم */
function dayLabel(session: KhademSession, isToday: boolean, allDaysSameActivity: { session: KhademSession }[]) {
  const base = isToday ? "النهاردة" : formatDate(session.session_date);
  const sameDateCount = allDaysSameActivity.filter((d) => d.session.session_date === session.session_date).length;
  return sameDateCount > 1 ? `${base} (جلسة ${session.session_no})` : base;
}

export default function KhodamPage() {
  return (
    <PasswordGate storageKey="unlocked_khodam">
      <KhodamContent />
    </PasswordGate>
  );
}

function KhodamContent() {
  const { toast } = useToast();
  const [khodam, setKhodam] = useState<Khadem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sessions, setSessions] = useState<KhademSession[]>([]);
  const [checkins, setCheckins] = useState<KhademCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const [groupName, setGroupName] = useState("");
  const [activityKey, setActivityKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNames, setShowNames] = useState<Record<string, boolean>>({});
  const [selectedDay, setSelectedDay] = useState<Record<string, string>>({});

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const [k, a, s, c] = await Promise.all([
      fetchKhodam(),
      fetchActivities(false),
      fetchAllKhodamSessions(),
      fetchAllKhodamCheckins(),
    ]);
    setKhodam(k);
    setActivities(a);
    setSessions(s);
    setCheckins(c);
    if (!activityKey && a[0]) {
      setGroupName(a[0].group_name);
      setActivityKey(a[0].key);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const activitiesInGroup = useMemo(() => activities.filter((a) => a.group_name === groupName), [activities, groupName]);

  function handleSelectGroup(g: string) {
    setGroupName(g);
    const first = activities.find((a) => a.group_name === g);
    if (first) setActivityKey(first.key);
  }

  // الجلسة المفتوحة النهاردة للنشاط المختار — جلسات الخدام مستقلة تمامًا عن جلسات المشاركين
  const openSession = useMemo(
    () => sessions.find((s) => s.activity_key === activityKey && s.session_date === today && !s.locked),
    [sessions, activityKey, today]
  );

  const checkedIds = useMemo(
    () => new Set(checkins.filter((c) => openSession && c.session_id === openSession.id).map((c) => c.khadem_id)),
    [checkins, openSession]
  );

  async function handleStartToday() {
    if (!activityKey) return;
    setBusy(true);
    try {
      await startKhodamSession(activityKey);
      toast("اتفتحت جلسة النهاردة", "success");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleLockToday() {
    if (!openSession) return;
    if (!confirm("هتقفل جلسة النهاردة؟ مش هتقدر تسجل حضور فيها تاني إلا لو فتحتها تاني.")) return;
    setBusy(true);
    try {
      await lockKhodamSession(openSession.id);
      toast("اتقفلت الجلسة", "info");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleCheckin(khademId: string) {
    if (!openSession) return;
    if (checkedIds.has(khademId)) await undoKhademCheckin(khademId, openSession.id);
    else await checkInKhadem(khademId, openSession.id);
    // بنحدّث بس تسجيلات الحضور بتاعة الجلسة دي، من غير ما نعيد تحميل الصفحة كلها
    // (عشان مايحصلش أي وميض أو إحساس إن الصفحة "بتقفل" وترجع تسألك تختار النشاط تاني)
    const fresh = await fetchKhodamCheckinsForSession(openSession.id);
    setCheckins((prev) => [...prev.filter((c) => c.session_id !== openSession.id), ...fresh]);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await createKhadem(newName.trim());
    setNewName("");
    toast("اتضاف الخادم", "success");
    load();
  }

  async function handleRename(id: string, name: string) {
    if (!name.trim()) return;
    await renameKhadem(id, name.trim());
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("تمسح الخادم ده؟")) return;
    await deleteKhadem(id);
    toast("اتشال الخادم", "info");
    load();
  }

  // تحليل حضور الخدام: لكل نشاط، لكل يوم (جلسة)، نسبة الحضور + الأسماء
  const analysis = useMemo(() => {
    return activities.map((activity) => {
      const activitySessions = sessions
        .filter((s) => s.activity_key === activity.key)
        .sort((a, b) => (a.session_date < b.session_date ? 1 : -1));
      const days = activitySessions.map((session) => {
        const sessionCheckins = checkins.filter((c) => c.session_id === session.id);
        const presentIds = new Set(sessionCheckins.map((c) => c.khadem_id));
        const presentNames = khodam.filter((k) => presentIds.has(k.id)).map((k) => k.name);
        const absentNames = khodam.filter((k) => !presentIds.has(k.id)).map((k) => k.name);
        const pct = khodam.length ? Math.round((presentIds.size / khodam.length) * 100) : 0;
        return { session, isToday: session.session_date === today, presentCount: presentIds.size, pct, presentNames, absentNames };
      });
      return { activity, days };
    });
  }, [activities, sessions, checkins, khodam, today]);

  const analysisGroups = useMemo(() => {
    const map = new Map<string, typeof analysis>();
    analysis.forEach((item) => {
      const list = map.get(item.activity.group_name) ?? [];
      list.push(item);
      map.set(item.activity.group_name, list);
    });
    return Array.from(map.entries());
  }, [analysis]);

  function handleExportExcel() {
    const rows = khodam.map((k, i) => {
      const mine = checkins.filter((c) => c.khadem_id === k.id);
      const total = sessions.filter((s) => s.started_at).length;
      const pct = total > 0 ? Math.round((mine.length / total) * 100) : 0;
      return { م: i + 1, الاسم: k.name, "عدد الفقرات المحضورة": mine.length, "من إجمالي": total, "النسبة %": pct };
    });
    exportTableExcel(rows, "الخدام", "khodam.xlsx");
  }

  function handleExportPdf() {
    const rows = khodam.map((k, i) => {
      const mine = checkins.filter((c) => c.khadem_id === k.id);
      const total = sessions.filter((s) => s.started_at).length;
      const pct = total > 0 ? Math.round((mine.length / total) * 100) : 0;
      return { م: i + 1, الاسم: k.name, "عدد الفقرات المحضورة": mine.length, "من إجمالي": total, "النسبة %": `${pct}%` };
    });
    exportTablePdf(rows, "تقرير حضور الخدام");
  }

  if (loading) return <div className="text-textdim">جارِ التحميل…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">الخدام</h1>
          <p className="mt-1 text-sm text-textdim">
            حضور الخدام بالفقرة — صفحة ونظام جلسات مستقلين تمامًا عن نظام النقاط والفرق وحضور المشاركين. مفيش
            أي تداخل بينهم خالص.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="rounded-xl border border-border px-3 py-2 text-xs font-bold">
            تصدير Excel
          </button>
          <button onClick={handleExportPdf} className="rounded-xl border border-border px-3 py-2 text-xs font-bold">
            تصدير PDF
          </button>
        </div>
      </div>

      {/* تسجيل الحضور بالفقرة */}
      <Card>
        <h2 className="mb-3 font-display font-bold">تسجيل الحضور</h2>
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border p-1">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => handleSelectGroup(g)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${groupName === g ? "bg-gold text-[#241A03]" : "text-textdim"}`}
            >
              {g}
            </button>
          ))}
        </div>
        {activitiesInGroup.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-1">
            {activitiesInGroup.map((a) => (
              <button
                key={a.key}
                onClick={() => setActivityKey(a.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activityKey === a.key ? "bg-teal/20 text-teal" : "text-textdim"}`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {!openSession ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm text-textdim">لسه ما بدأتش النهاردة للنشاط ده</p>
            <button disabled={busy} onClick={handleStartToday} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03] disabled:opacity-50">
              ابدأ اليوم
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="rounded-full bg-teal/15 px-3 py-1.5 text-xs font-bold text-teal">جلسة النهاردة شغالة</span>
              <button
                disabled={busy}
                onClick={handleLockToday}
                className="rounded-xl border border-coral px-3 py-1.5 text-xs font-bold text-coral disabled:opacity-50"
              >
                اقفل الجلسة
              </button>
            </div>
            {khodam.map((k) => {
              const done = checkedIds.has(k.id);
              return (
                <div key={k.id} className="flex items-center justify-between border-t border-border py-2.5 first:border-none">
                  <span className="text-sm">{k.name}</span>
                  <button
                    onClick={() => toggleCheckin(k.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      done ? "bg-teal/20 text-teal" : "border border-border text-textdim"
                    }`}
                  >
                    {done ? "حضر ✓" : "سجّل حضور"}
                  </button>
                </div>
              );
            })}
            {khodam.length === 0 && <p className="py-6 text-center text-sm text-textdim">لسه مفيش خدام مضافين</p>}
          </div>
        )}
      </Card>

      {/* تحليل حضور الخدام */}
      <Card>
        <h2 className="mb-1 font-display font-bold">تحليل حضور الخدام</h2>
        <p className="mb-4 text-xs text-textdim">دوس على أي يوم عشان تشوف مين حضر ومين غايب</p>
        <div className="flex flex-col gap-6">
          {analysisGroups.map(([group, list]) => (
            <div key={group}>
              <div className="mb-3 text-xs font-bold text-gold">{group}</div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(({ activity, days }) => {
                  if (days.length === 0) {
                    return (
                      <div key={activity.key} className="rounded-xl border border-border p-3.5 text-center">
                        <div className="mb-2 text-sm font-bold">{activity.name}</div>
                        <p className="text-xs text-textdim">لسه معملتش جلسة</p>
                      </div>
                    );
                  }
                  const currentId = selectedDay[activity.key] ?? days[0].session.id;
                  const current = days.find((d) => d.session.id === currentId) ?? days[0];
                  const isOpen = !!showNames[current.session.id];
                  return (
                    <div key={activity.key} className="rounded-xl border border-border p-3.5">
                      <div className="mb-2 text-center text-sm font-bold">{activity.name}</div>
                      {days.length > 1 && (
                        <div className="mb-3 flex flex-wrap justify-center gap-1">
                          {days.map(({ session, isToday }) => (
                            <span
                              key={session.id}
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                currentId === session.id ? "bg-gold text-[#241A03]" : "bg-surface2 text-textdim"
                              }`}
                            >
                              <button onClick={() => setSelectedDay((prev) => ({ ...prev, [activity.key]: session.id }))}>
                                {dayLabel(session, isToday, days)}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm("تمسح الجلسة دي نهائيًا؟ هيتمسح معاها كل تسجيلات الحضور بتاعتها.")) return;
                                  await deleteKhodamSession(session.id);
                                  toast("اتمسحت الجلسة", "info");
                                  load();
                                }}
                                className="text-coral"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {days.length === 1 && (
                        <div className="mb-3 flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-textdim">
                            {current.isToday ? "النهاردة" : formatDate(current.session.session_date)}
                            {!current.session.locked && current.isToday && <span className="ms-1.5 text-teal">●</span>}
                          </span>
                          <button
                            onClick={async () => {
                              if (!confirm("تمسح الجلسة دي نهائيًا؟ هيتمسح معاها كل تسجيلات الحضور بتاعتها.")) return;
                              await deleteKhodamSession(current.session.id);
                              toast("اتمسحت الجلسة", "info");
                              load();
                            }}
                            className="text-[10px] font-bold text-coral underline"
                          >
                            امسح الجلسة دي
                          </button>
                        </div>
                      )}
                      <div className="text-center text-xl font-extrabold text-gold">{current.pct}%</div>
                      <div className="text-center text-[11px] text-textdim">{current.presentCount}/{khodam.length} حضروا</div>
                      <button
                        onClick={() => setShowNames((prev) => ({ ...prev, [current.session.id]: !prev[current.session.id] }))}
                        className="mt-2 block w-full text-center text-[11px] text-textdim underline"
                      >
                        {isOpen ? "اقفل التفاصيل" : "شوف الأسماء"}
                      </button>
                      {isOpen && (
                        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface2 p-3 text-start">
                          <div>
                            <div className="text-[11px] font-bold text-teal">حضروا ({current.presentNames.length})</div>
                            <div className="mt-1 text-xs text-textdim">{current.presentNames.length ? current.presentNames.join("، ") : "—"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-coral">غايبين ({current.absentNames.length})</div>
                            <div className="mt-1 text-xs text-textdim">{current.absentNames.length ? current.absentNames.join("، ") : "—"}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display font-bold">إدارة قائمة الخدام</h2>
        <div className="flex flex-col gap-2">
          {khodam.map((k) => (
            <div key={k.id} className="flex items-center gap-2 border-t border-border pt-2 first:border-none first:pt-0">
              <input
                defaultValue={k.name}
                onBlur={(e) => handleRename(k.id, e.target.value)}
                className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-surface2"
              />
              <button onClick={() => handleDelete(k.id)} className="rounded-lg border border-coral px-2.5 py-1.5 text-xs font-semibold text-coral">
                حذف
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="اسم الخادم الجديد…"
            className="flex-1 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button onClick={handleAdd} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03]">
            ضيف خادم
          </button>
        </div>
      </Card>
    </div>
  );
}
