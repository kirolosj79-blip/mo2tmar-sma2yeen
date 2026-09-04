export type Stage = "elementary" | "preparatory" | "secondary" | "university";

export interface Team {
  id: string;
  name: string;
  color: string;
  bonus_pts: number; // بونص جماعي للفريق نفسه — منفصل عن نقاط الأفراد
  created_at?: string;
}

export interface Activity {
  key: string;
  name: string;
  group_name: string; // بيجمع الأنشطة المتشابهة مع بعض (مثلاً "حصة" بتجمع حصة ١/٢/٣)
  base_points: number;
  bonus_points: number;
  sort_order: number; // ترتيب الظهور في التابات
  is_active: boolean; // لو false، النشاط مخفي من كل التابات
}

export interface Participant {
  id: string;
  name: string;
  team_id: string | null;
  stage: Stage;
  bonus_pts: number;
}

export interface ActivityCheckin {
  id: string;
  participant_id: string;
  session_id: string;
  activity_key: string;
  points: number;
  is_bonus: boolean;
  checked_at: string;
}

export interface ActivitySession {
  id: string;
  activity_key: string;
  session_date: string;
  session_no: number;
  duration_minutes: number;
  points: number | null; // نقطة الحضور المبكر اللي بتتحدد وقت بدء الجلسة
  started_at: string | null;
  locked: boolean;
  created_at: string;
}

export interface BonusLogEntry {
  id: string;
  target_type: "participant" | "team";
  participant_id: string | null;
  team_id: string | null;
  points: number;
  reason: string | null;
  admin: string;
  log_date: string;
  flagged: boolean;
  created_at: string;
}

export interface Admin {
  id: string;
  name: string;
}

export interface AppSettings {
  id: number;
  bonus_threshold: number;
}

/** Participant with computed totals, as returned by the `participant_totals` view */
export interface ParticipantTotals {
  id: string;
  name: string;
  team_id: string | null;
  stage: Stage;
  general_points: number; // تاريخي بس — الحضور العام اتشال من الواجهة، القيمة دي بتفضل ٠ في المشاريع الجديدة
  bonus_pts: number;
  activity_points: number;
  total_points: number;
}

/** الخدام — قايمة وحضور منفصلة تمامًا عن نظام النقاط والفرق */
export interface Khadem {
  id: string;
  name: string;
  created_at?: string;
}

export interface KhademAttendance {
  id: string;
  khadem_id: string;
  attendance_date: string;
  present: boolean;
}

/** حضور الخدام بالفقرة — بيستخدم نفس جلسات الأنشطة اللي بيستخدمها المشاركين، بس من غير نقط */
export interface KhademCheckin {
  id: string;
  khadem_id: string;
  session_id: string;
  checked_at: string;
}

/** جلسة حضور مستقلة تمامًا عن جلسات المشاركين (activity_sessions) */
export interface KhademSession {
  id: string;
  activity_key: string;
  session_date: string;
  session_no: number;
  started_at: string | null;
  locked: boolean;
  created_at: string;
}

// Minimal Database shape for supabase-js generics. Extend with `supabase gen types`
// once your project is live, if you want full end-to-end type safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
