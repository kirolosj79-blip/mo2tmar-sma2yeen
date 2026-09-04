-- ============================================================
-- Migration 006 — رجوع "حصة" لـ ١-٣ بس (بدل ١-٧)، حضور الخدام
-- بالفقرات (زي المشاركين بالظبط بس من غير نقط)، وأداة تصفير الدرجات.
-- آمن يتشغل على قاعدة فيها بيانات حقيقية.
-- ============================================================

-- 1) شيل حصة ٤ لـ ٧ (الجلسات وتسجيلات الحضور بتاعتهم بتتمسح معاهم أوتوماتيك
-- عن طريق cascade — لو حسيت إنك مستخدمها فعليًا، متشغلش السطر ده)
delete from activities where key in ('lesson_4', 'lesson_5', 'lesson_6', 'lesson_7');

-- 2) حضور الخدام بالفقرة (نفس نظام المشاركين بالظبط، بس من غير نقط خالص)
create table if not exists khodam_checkins (
  id uuid primary key default gen_random_uuid(),
  khadem_id uuid not null references khodam(id) on delete cascade,
  session_id uuid not null references activity_sessions(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (khadem_id, session_id)
);

create index if not exists idx_khodam_checkins_session on khodam_checkins(session_id);

alter table khodam_checkins enable row level security;
drop policy if exists "public read khodam_checkins" on khodam_checkins;
drop policy if exists "public write khodam_checkins" on khodam_checkins;
create policy "public read khodam_checkins" on khodam_checkins for select using (true);
create policy "public write khodam_checkins" on khodam_checkins for all using (true) with check (true);
