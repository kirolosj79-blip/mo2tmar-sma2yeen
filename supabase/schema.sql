-- ============================================================
-- ساحة المؤتمر · كنائس زويلة — Supabase schema
-- شغّل الملف ده في Supabase SQL Editor مرة واحدة بس عشان تجهز القاعدة
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- teams ----------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#F2B84B',
  bonus_pts int not null default 0, -- نقاط بونص جماعية للفريق نفسه — منفصلة عن نقاط الأفراد تمامًا
  created_at timestamptz not null default now()
);

-- ---------- activities (مثل: القداس، الحصة ١/٢/٣، الورشة ١/٢، عشية، تسبحة، كلمة سيدنا) ----------
create table if not exists activities (
  key text primary key,
  name text not null,
  group_name text not null default '', -- بيجمع الأنشطة المتشابهة مع بعض في تابات (مثلاً "حصة" بتجمع حصة ١/٢/٣)
  base_points int not null default 10,
  bonus_points int not null default 20,
  sort_order int not null default 0, -- بيحدد ترتيب ظهور التابات (زي ترتيب اليوم الفعلي)
  is_active boolean not null default true, -- لو false، النشاط بيتخبى من كل التابات لحد ما تفعّله من الإعدادات
  created_at timestamptz not null default now()
);

-- ---------- participants ----------
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid references teams(id) on delete set null,
  stage text not null check (stage in ('elementary','preparatory','secondary','university')),
  bonus_pts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_participants_team on participants(team_id);
create index if not exists idx_participants_stage on participants(stage);

-- ---------- activity sessions (جلسة يومية منفصلة لكل نشاط — النهاردة/بكرة/بعد بكرة) ----------
create table if not exists activity_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_key text not null references activities(key) on delete cascade,
  session_date date not null default current_date,
  session_no int not null default 1,
  duration_minutes int not null default 10,
  points int, -- قيمة نقاط الحضور المبكر اللي بتتحدد وقت بدء الجلسة (بدل القيمة الثابتة في الأنشطة)
  started_at timestamptz,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (activity_key, session_date, session_no)
);

create index if not exists idx_sessions_activity_open
  on activity_sessions(activity_key, session_date) where locked = false;

-- ---------- activity check-ins (الحضور لكل جلسة) ----------
create table if not exists activity_checkins (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  session_id uuid not null references activity_sessions(id) on delete cascade,
  activity_key text not null references activities(key) on delete cascade,
  points int not null default 0,
  is_bonus boolean not null default false,
  checked_at timestamptz not null default now(),
  unique (participant_id, session_id)
);

create index if not exists idx_checkins_session on activity_checkins(session_id);


-- ---------- bonus / audit log ----------
create table if not exists bonus_log (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('participant','team')),
  participant_id uuid references participants(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  points int not null,
  reason text,
  admin text not null,
  log_date date not null default current_date,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- admins list (لاختيار اسم الأدمن وقت إضافة نقاط) ----------
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- global settings (صف واحد بس) ----------
create table if not exists app_settings (
  id int primary key default 1,
  bonus_threshold int not null default 15,
  constraint single_row check (id = 1)
);

-- ---------- convenience view: مجموع نقاط كل مشارك (فردي بحت — من غير أي بونص جماعي) ----------
create or replace view participant_totals as
select
  p.id,
  p.name,
  p.team_id,
  p.stage,
  0 as general_points, -- مفيش حضور عام في التركيبة الجديدة؛ الحقل ده لسه موجود عشان يتوافق مع نفس شكل البيانات في المشاريع القديمة
  p.bonus_pts,
  coalesce(sum(c.points), 0) as activity_points,
  p.bonus_pts + coalesce(sum(c.points), 0) as total_points
from participants p
left join activity_checkins c on c.participant_id = p.id
group by p.id;

-- ============================================================
-- الخدام — قايمة وحضور منفصلة تمامًا عن نظام النقاط والفرق.
-- مجرد داتا حضور/غياب ونسبة، مش بتأثر على أي ترتيب أو مجموع نقاط.
-- ============================================================
create table if not exists khodam (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists khodam_attendance (
  id uuid primary key default gen_random_uuid(),
  khadem_id uuid not null references khodam(id) on delete cascade,
  attendance_date date not null default current_date,
  present boolean not null default true,
  created_at timestamptz not null default now(),
  unique (khadem_id, attendance_date)
);

create index if not exists idx_khodam_attendance_khadem on khodam_attendance(khadem_id);

-- جلسات الخدام — مستقلة تمامًا عن جلسات المشاركين (activity_sessions)، عشان قفل/فتح
-- جلسة في صفحة الخدام ميأثرش خالص على المشاركين، ولا يدخل في حساب نسبة حضورهم
create table if not exists khodam_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_key text not null references activities(key) on delete cascade,
  session_date date not null default current_date,
  session_no int not null default 1,
  started_at timestamptz,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (activity_key, session_date, session_no)
);

-- حضور الخدام بالفقرة — بيستخدم جلسات الخدام المستقلة دي بس، من غير نقط خالص
create table if not exists khodam_checkins (
  id uuid primary key default gen_random_uuid(),
  khadem_id uuid not null references khodam(id) on delete cascade,
  session_id uuid not null references khodam_sessions(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (khadem_id, session_id)
);

create index if not exists idx_khodam_checkins_session on khodam_checkins(session_id);

-- ============================================================
-- Row Level Security
-- ملاحظة: السياسات دي مفتوحة للتجربة والتطوير فقط (public read/write).
-- قبل ما تنشر المشروع فعليًا، بدّلها بسياسات مبنية على auth.uid()
-- أو استخدم Supabase Auth + أدوار (admin/viewer) حسب احتياجك.
-- ============================================================
alter table teams enable row level security;
alter table activities enable row level security;
alter table participants enable row level security;
alter table activity_sessions enable row level security;
alter table activity_checkins enable row level security;
alter table bonus_log enable row level security;
alter table admins enable row level security;
alter table app_settings enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public write teams" on teams for all using (true) with check (true);

create policy "public read activities" on activities for select using (true);
create policy "public write activities" on activities for all using (true) with check (true);

create policy "public read participants" on participants for select using (true);
create policy "public write participants" on participants for all using (true) with check (true);

create policy "public read checkins" on activity_checkins for select using (true);
create policy "public write checkins" on activity_checkins for all using (true) with check (true);

create policy "public read sessions" on activity_sessions for select using (true);
create policy "public write sessions" on activity_sessions for all using (true) with check (true);

create policy "public read bonus_log" on bonus_log for select using (true);
create policy "public write bonus_log" on bonus_log for all using (true) with check (true);

create policy "public read admins" on admins for select using (true);
create policy "public write admins" on admins for all using (true) with check (true);

create policy "public read app_settings" on app_settings for select using (true);
create policy "public write app_settings" on app_settings for all using (true) with check (true);

alter table khodam enable row level security;
alter table khodam_attendance enable row level security;
create policy "public read khodam" on khodam for select using (true);
create policy "public write khodam" on khodam for all using (true) with check (true);
create policy "public read khodam_attendance" on khodam_attendance for select using (true);
create policy "public write khodam_attendance" on khodam_attendance for all using (true) with check (true);

alter table khodam_checkins enable row level security;
create policy "public read khodam_checkins" on khodam_checkins for select using (true);
create policy "public write khodam_checkins" on khodam_checkins for all using (true) with check (true);

alter table khodam_sessions enable row level security;
create policy "public read khodam_sessions" on khodam_sessions for select using (true);
create policy "public write khodam_sessions" on khodam_sessions for all using (true) with check (true);

-- ============================================================
-- Seed data (اختياري) — نفس بيانات النسخة الأصلية تقريبًا
-- ============================================================
insert into app_settings (id, bonus_threshold)
values (1, 15)
on conflict (id) do nothing;

insert into activities (key, name, group_name, base_points, bonus_points, sort_order, is_active) values
  ('mass', 'القداس', 'قداس', 10, 20, 1, true),
  ('lesson_1', 'حصة ١', 'حصة', 10, 20, 2, true),
  ('workshop_1', 'ورشة ١', 'ورشة', 10, 20, 3, true),
  ('workshop_2', 'ورشة ٢', 'ورشة', 10, 20, 4, true),
  ('lesson_2', 'حصة ٢', 'حصة', 10, 20, 5, true),
  ('vespers', 'عشية', 'عشية', 10, 20, 6, true),
  ('lesson_3', 'حصة ٣', 'حصة', 10, 20, 7, true),
  ('tasbeha', 'تسبحة', 'تسبحة', 10, 20, 8, true),
  ('father_word', 'كلمة سيدنا', 'كلمة سيدنا', 10, 20, 9, false)
on conflict (key) do nothing;

insert into admins (name) values ('Admin 1'), ('Admin 2'), ('Admin 3')
on conflict (name) do nothing;

insert into teams (name, color) values
  ('الأحمر', '#EF4444'),
  ('الأصفر', '#F2B84B'),
  ('الأزرق', '#60A5FA'),
  ('الأخضر', '#34D399')
on conflict do nothing;

-- نفس أسماء الروستر الافتراضية اللي كانت في الملف الأصلي (مرحلة إعدادي وثانوي)،
-- موزعين بالتبادل على الفرق الأربعة. مرحلة الابتدائي بتفضل فاضية زي الأصل.
do $$
declare
  team_ids uuid[];
  prep_names text[] := array[
    'توماس صبري','توماس ايهاب','يسطس مينا','فيلوباتير كرم','بولا سامح','جورج عماد','جون رومانى',
    'جونير مجدى','جويس ايمن','جانيت عاطف','جاكلين عاطف','جونير مدحت','فيرونيا مدحت','بارثينيا جوزيف',
    'جونير صبحى','أوليفيا عزت','مارينا قدرى','جويس رأفت','مريم نصر','ميرولا جميل','جوليانا عماد',
    'ايرينى سامى','جويس مجدى'
  ];
  secondary_names text[] := array[
    'جويس سامح','أيفرنا ريمون','بولا ميخائيل','جوليا مدحت','ماريا محسن','أغابي خالد','يسطس حبيب',
    'جومانا رأفت','ماريوس ماهر','توماس جرجس','فادي ناصر','يؤانا اسحق','ميلاد عماد','دميانه جميل',
    'جولييت جون','انطونيوس سامى'
  ];
  n int;
begin
  if exists (select 1 from participants limit 1) then
    return; -- خلي السكريبت آمن لو اتشغل تاني، مايكررش الروستر
  end if;

  select array_agg(id order by created_at) into team_ids from teams;
  if team_ids is null or array_length(team_ids, 1) = 0 then
    return;
  end if;

  for n in 1 .. array_length(prep_names, 1) loop
    insert into participants (name, team_id, stage)
    values (prep_names[n], team_ids[((n - 1) % array_length(team_ids, 1)) + 1], 'preparatory');
  end loop;

  for n in 1 .. array_length(secondary_names, 1) loop
    insert into participants (name, team_id, stage)
    values (secondary_names[n], team_ids[((n - 1) % array_length(team_ids, 1)) + 1], 'secondary');
  end loop;
end $$;
