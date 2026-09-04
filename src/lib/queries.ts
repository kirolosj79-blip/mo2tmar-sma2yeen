import { supabase } from "@/lib/supabase/client";
import type {
  Team,
  Activity,
  Participant,
  ActivityCheckin,
  ActivitySession,
  BonusLogEntry,
  Admin,
  AppSettings,
  ParticipantTotals,
  Stage,
  Khadem,
  KhademAttendance,
  KhademCheckin,
  KhademSession,
} from "@/lib/types";

/* ============================= TEAMS ============================= */
export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createTeam(name: string, color: string) {
  const { data, error } = await supabase.from("teams").insert({ name, color }).select().single();
  if (error) throw error;
  return data as Team;
}

export async function deleteTeam(id: string) {
  await supabase.from("participants").update({ team_id: null }).eq("team_id", id);
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function renameTeam(id: string, name: string) {
  const { error } = await supabase.from("teams").update({ name }).eq("id", id);
  if (error) throw error;
}

/* ============================= ACTIVITIES ============================= */
export async function fetchActivities(includeInactive = true): Promise<Activity[]> {
  let query = supabase.from("activities").select("*").order("sort_order").order("created_at");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createActivity(key: string, name: string, groupName: string, basePoints: number, bonusPoints: number) {
  const { error } = await supabase
    .from("activities")
    .insert({ key, name, group_name: groupName, base_points: basePoints, bonus_points: bonusPoints });
  if (error) throw error;
}

export async function updateActivity(key: string, patch: Partial<Activity>) {
  const { error } = await supabase.from("activities").update(patch).eq("key", key);
  if (error) throw error;
}

export async function deleteActivity(key: string) {
  const { error } = await supabase.from("activities").delete().eq("key", key);
  if (error) throw error;
}

/* ============================= PARTICIPANTS ============================= */
export async function fetchParticipants(stage?: Stage): Promise<Participant[]> {
  let query = supabase.from("participants").select("*").order("name");
  if (stage) query = query.eq("stage", stage);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchParticipantTotals(stage?: Stage): Promise<ParticipantTotals[]> {
  let query = supabase.from("participant_totals").select("*");
  if (stage) query = query.eq("stage", stage);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ParticipantTotals[];
}

export async function createParticipant(name: string, teamId: string | null, stage: Stage) {
  const { data, error } = await supabase
    .from("participants")
    .insert({ name, team_id: teamId, stage })
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}

export async function updateParticipant(id: string, patch: Partial<Participant>) {
  const { error } = await supabase.from("participants").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteParticipant(id: string) {
  const { error } = await supabase.from("participants").delete().eq("id", id);
  if (error) throw error;
}

/* ============================= ACTIVITY SESSIONS (يوم كامل = جلسة واحدة لكل نشاط) ============================= */

/** الجلسة المفتوحة النهاردة بالظبط للنشاط ده، لو موجودة. لو مفيش، معناها اليوم ده لسه ما بدأش. */
export async function fetchOpenSession(activityKey: string): Promise<ActivitySession | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("activity_sessions")
    .select("*")
    .eq("activity_key", activityKey)
    .eq("session_date", today)
    .eq("locked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** كل جلسات النهاردة للنشاط ده (مقفولة أو لأ) */
export async function fetchTodaySessions(activityKey: string): Promise<ActivitySession[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("activity_sessions")
    .select("*")
    .eq("activity_key", activityKey)
    .eq("session_date", today)
    .order("session_no");
  if (error) throw error;
  return data ?? [];
}

/** بدء يوم جديد. points = قيمة نقاط الحضور المبكر اللي بتتحدد قبل البدء (بدل القيمة الثابتة). */
export async function startNewSession(
  activityKey: string,
  durationMinutes: number,
  points: number
): Promise<ActivitySession> {
  const todaySessions = await fetchTodaySessions(activityKey);
  const nextNo = (todaySessions.reduce((max, s) => Math.max(max, s.session_no), 0) || 0) + 1;
  const { data, error } = await supabase
    .from("activity_sessions")
    .insert({
      activity_key: activityKey,
      session_no: nextNo,
      duration_minutes: durationMinutes,
      points,
      started_at: new Date().toISOString(),
      locked: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ActivitySession;
}

/** قفل الجلسة الحالية — كده مفيش حد يقدر يسجل حضور فيها تاني، وأي "ابدأ جلسة" جديد هيعمل جولة جديدة */
export async function lockSession(sessionId: string) {
  const { error } = await supabase.from("activity_sessions").update({ locked: true }).eq("id", sessionId);
  if (error) throw error;
}

/** يمسح جلسة بالكامل (ولوحدها بيمسح كل تسجيلات الحضور اللي جواها) — مفيد لمسح جلسات تجربة */
export async function deleteSession(sessionId: string) {
  const { error } = await supabase.from("activity_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

/* ============================= ACTIVITY CHECK-INS ============================= */
export async function fetchCheckinsForSession(sessionId: string): Promise<ActivityCheckin[]> {
  const { data, error } = await supabase.from("activity_checkins").select("*").eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

export async function checkInParticipant(
  participantId: string,
  sessionId: string,
  activityKey: string,
  points: number,
  isBonus: boolean
) {
  const { error } = await supabase
    .from("activity_checkins")
    .upsert(
      {
        participant_id: participantId,
        session_id: sessionId,
        activity_key: activityKey,
        points,
        is_bonus: isBonus,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,session_id" }
    );
  if (error) throw error;
}

export async function undoCheckin(participantId: string, sessionId: string) {
  const { error } = await supabase
    .from("activity_checkins")
    .delete()
    .eq("participant_id", participantId)
    .eq("session_id", sessionId);
  if (error) throw error;
}

/** كل تسجيلات الحضور لنشاط معين (كل الجلسات) — مستخدمة في لوحة العرض العامة لحساب النسب */
export async function fetchAllCheckinsForActivity(activityKey: string): Promise<ActivityCheckin[]> {
  const { data, error } = await supabase.from("activity_checkins").select("*").eq("activity_key", activityKey);
  if (error) throw error;
  return data ?? [];
}

/* ============================= BONUS LOG ============================= */
export async function fetchBonusLog(): Promise<BonusLogEntry[]> {
  const { data, error } = await supabase
    .from("bonus_log")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addBonusPoints(entry: {
  targetType: "participant" | "team";
  participantId?: string | null;
  teamId?: string | null;
  points: number;
  reason: string;
  admin: string;
  date: string;
  flagged: boolean;
}) {
  const { error } = await supabase.from("bonus_log").insert({
    target_type: entry.targetType,
    participant_id: entry.participantId ?? null,
    team_id: entry.teamId ?? null,
    points: entry.points,
    reason: entry.reason,
    admin: entry.admin,
    log_date: entry.date,
    flagged: entry.flagged,
  });
  if (error) throw error;

  if (entry.targetType === "participant" && entry.participantId) {
    const { data: p } = await supabase
      .from("participants")
      .select("bonus_pts")
      .eq("id", entry.participantId)
      .single();
    await supabase
      .from("participants")
      .update({ bonus_pts: (p?.bonus_pts ?? 0) + entry.points })
      .eq("id", entry.participantId);
  } else if (entry.targetType === "team" && entry.teamId) {
    // بونص الفريق بيتحدث في جدول الفرق نفسه — منفصل تمامًا عن نقاط أي فرد
    const { data: t } = await supabase.from("teams").select("bonus_pts").eq("id", entry.teamId).single();
    await supabase
      .from("teams")
      .update({ bonus_pts: (t?.bonus_pts ?? 0) + entry.points })
      .eq("id", entry.teamId);
  }
}

export async function bulkApplyPoints(
  entries: { participantId: string; points: number }[],
  reason: string,
  admin: string,
  date: string,
  bonusThreshold: number
) {
  for (const e of entries) {
    await addBonusPoints({
      targetType: "participant",
      participantId: e.participantId,
      points: e.points,
      reason,
      admin,
      date,
      flagged: Math.abs(e.points) >= bonusThreshold,
    });
  }
}

/* ============================= ADMINS ============================= */
export async function fetchAdmins(): Promise<Admin[]> {
  const { data, error } = await supabase.from("admins").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addAdmin(name: string) {
  const { error } = await supabase.from("admins").insert({ name });
  if (error) throw error;
}

export async function removeAdmin(id: string) {
  const { error } = await supabase.from("admins").delete().eq("id", id);
  if (error) throw error;
}

/* ============================= SETTINGS ============================= */
export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as AppSettings;
}

export async function updateSettings(patch: Partial<AppSettings>) {
  const { error } = await supabase.from("app_settings").update(patch).eq("id", 1);
  if (error) throw error;
}

/* ============================= AGGREGATES (for the public board) ============================= */

/** All check-ins across every activity — used to compute per-activity attendance counts. */
export async function fetchAllCheckins(): Promise<ActivityCheckin[]> {
  const { data, error } = await supabase.from("activity_checkins").select("*");
  if (error) throw error;
  return data ?? [];
}

/** كل الجلسات (كل الأنشطة، كل الأيام) — عشان نقدر نعمل تحليل حضور منفصل لكل يوم لوحده */
export async function fetchAllSessions(): Promise<ActivitySession[]> {
  const { data, error } = await supabase
    .from("activity_sessions")
    .select("*")
    .order("session_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Bonus log entries logged today — used to estimate the fastest-climbing team ("الحصان الأسود"). */
export async function fetchTodayBonusLog(): Promise<BonusLogEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("bonus_log").select("*").eq("log_date", today);
  if (error) throw error;
  return data ?? [];
}

/* ============================= الخدام (منفصل تمامًا عن نظام النقاط) ============================= */
export async function fetchKhodam(): Promise<Khadem[]> {
  const { data, error } = await supabase.from("khodam").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createKhadem(name: string) {
  const { error } = await supabase.from("khodam").insert({ name });
  if (error) throw error;
}

export async function renameKhadem(id: string, name: string) {
  const { error } = await supabase.from("khodam").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteKhadem(id: string) {
  const { error } = await supabase.from("khodam").delete().eq("id", id);
  if (error) throw error;
}

/** كل سجلات حضور الخدام على مر الأيام — بيتحسب منها النسبة */
export async function fetchAllKhodamAttendance(): Promise<KhademAttendance[]> {
  const { data, error } = await supabase.from("khodam_attendance").select("*");
  if (error) throw error;
  return data ?? [];
}

/** تسجيل حضور/غياب خادم في يوم معيّن (افتراضيًا النهاردة) */
export async function setKhademAttendance(khademId: string, present: boolean, date?: string) {
  const attendance_date = date ?? new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("khodam_attendance")
    .upsert({ khadem_id: khademId, attendance_date, present }, { onConflict: "khadem_id,attendance_date" });
  if (error) throw error;
}

export async function removeKhademAttendance(khademId: string, date?: string) {
  const attendance_date = date ?? new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("khodam_attendance")
    .delete()
    .eq("khadem_id", khademId)
    .eq("attendance_date", attendance_date);
  if (error) throw error;
}

/* ============================= جلسات الخدام (مستقلة تمامًا عن جلسات المشاركين) ============================= */
export async function fetchKhodamOpenSession(activityKey: string): Promise<KhademSession | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("khodam_sessions")
    .select("*")
    .eq("activity_key", activityKey)
    .eq("session_date", today)
    .eq("locked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchKhodamTodaySessions(activityKey: string): Promise<KhademSession[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("khodam_sessions")
    .select("*")
    .eq("activity_key", activityKey)
    .eq("session_date", today)
    .order("session_no");
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllKhodamSessions(): Promise<KhademSession[]> {
  const { data, error } = await supabase.from("khodam_sessions").select("*").order("session_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function startKhodamSession(activityKey: string): Promise<KhademSession> {
  const todaySessions = await fetchKhodamTodaySessions(activityKey);
  const nextNo = (todaySessions.reduce((max, s) => Math.max(max, s.session_no), 0) || 0) + 1;
  const { data, error } = await supabase
    .from("khodam_sessions")
    .insert({ activity_key: activityKey, session_no: nextNo, started_at: new Date().toISOString(), locked: false })
    .select()
    .single();
  if (error) throw error;
  return data as KhademSession;
}

export async function lockKhodamSession(sessionId: string) {
  const { error } = await supabase.from("khodam_sessions").update({ locked: true }).eq("id", sessionId);
  if (error) throw error;
}

export async function deleteKhodamSession(sessionId: string) {
  const { error } = await supabase.from("khodam_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

/* ============================= حضور الخدام بالفقرة (زي المشاركين بالظبط، من غير نقط) ============================= */
export async function fetchAllKhodamCheckins(): Promise<KhademCheckin[]> {
  const { data, error } = await supabase.from("khodam_checkins").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function fetchKhodamCheckinsForSession(sessionId: string): Promise<KhademCheckin[]> {
  const { data, error } = await supabase.from("khodam_checkins").select("*").eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

export async function checkInKhadem(khademId: string, sessionId: string) {
  const { error } = await supabase
    .from("khodam_checkins")
    .upsert({ khadem_id: khademId, session_id: sessionId, checked_at: new Date().toISOString() }, { onConflict: "khadem_id,session_id" });
  if (error) throw error;
}

export async function undoKhademCheckin(khademId: string, sessionId: string) {
  const { error } = await supabase.from("khodam_checkins").delete().eq("khadem_id", khademId).eq("session_id", sessionId);
  if (error) throw error;
}

/* ============================= تصفير الدرجات (خطر — يمسح كل نقط الحضور والبونص) ============================= */
/** بيمسح كل تسجيلات حضور الأنشطة (نقط الأنشطة)، ويصفّر بونص كل فرد وكل فريق. مبيمسحش المشاركين أو الفرق نفسها. */
export async function resetAllScores() {
  const { error: e1 } = await supabase.from("activity_checkins").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("participants").update({ bonus_pts: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
  if (e2) throw e2;
  const { error: e3 } = await supabase.from("teams").update({ bonus_pts: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
  if (e3) throw e3;
}
