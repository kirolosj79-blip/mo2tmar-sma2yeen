-- ============================================================
-- Migration 002 — نظام الجلسات (Sessions)
-- شغّل الملف ده لو أنت أصلاً عامل schema.sql قبل كده وعندك بيانات حقيقية.
-- البيانات الحالية (فرق، مشاركين، نقاط) مش هتتمسح — بس هيتضاف نظام
-- جلسات يسمح إن كل نشاط (قداس/حصة/ورشة) يتكرر أكتر من مرة في اليوم.
-- ============================================================

create table if not exists activity_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_key text not null references activities(key) on delete cascade,
  session_date date not null default current_date,
  session_no int not null default 1,
  duration_minutes int not null default 10,
  started_at timestamptz,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (activity_key, session_date, session_no)
);

create index if not exists idx_sessions_activity_open
  on activity_sessions(activity_key, session_date) where locked = false;

alter table activity_checkins add column if not exists session_id uuid references activity_sessions(id) on delete cascade;

-- رحّل أي تسجيلات حضور قديمة لجلسة واحدة "تاريخية" مقفولة لكل نشاط، عشان محدش يضيع
do $$
declare
  act record;
  new_session_id uuid;
begin
  for act in select distinct activity_key from activity_checkins where session_id is null loop
    insert into activity_sessions (activity_key, session_date, session_no, locked)
    values (act.activity_key, current_date, 0, true)
    returning id into new_session_id;

    update activity_checkins
    set session_id = new_session_id
    where activity_key = act.activity_key and session_id is null;
  end loop;
end $$;

alter table activity_checkins alter column session_id set not null;

-- شيل القيد القديم اللي كان بيمنع نفس الشخص يتسجل حضور تاني للنشاط ده للأبد
alter table activity_checkins drop constraint if exists activity_checkins_participant_id_activity_key_key;
alter table activity_checkins drop constraint if exists activity_checkins_participant_session_key;
alter table activity_checkins add constraint activity_checkins_participant_session_key unique (participant_id, session_id);

alter table activity_sessions enable row level security;
drop policy if exists "public read sessions" on activity_sessions;
drop policy if exists "public write sessions" on activity_sessions;
create policy "public read sessions" on activity_sessions for select using (true);
create policy "public write sessions" on activity_sessions for all using (true) with check (true);

-- time_config القديمة بقت مش مستخدمة — سيبناها موجودة (مش هنمسحها تلقائي) لو عايز ترجع لبياناتها القديمة.
-- لو عايز تشيلها نهائي شغّل: drop table if exists time_config;
