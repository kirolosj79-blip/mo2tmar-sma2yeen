-- ============================================================
-- Migration 005 — إضافة الخدام (حضور منفصل تمامًا عن النقاط)
-- وتوسيع "حصة" من ١-٣ لـ ١-٧.
-- آمن يتشغل على قاعدة فيها بيانات حقيقية — مش هيمسح ولا نقطة.
-- ============================================================

-- 1) الخدام — جدول ونظام حضور مستقل تمامًا، مبيلمسش نقاط أو ترتيب حد
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

alter table khodam enable row level security;
alter table khodam_attendance enable row level security;

drop policy if exists "public read khodam" on khodam;
drop policy if exists "public write khodam" on khodam;
create policy "public read khodam" on khodam for select using (true);
create policy "public write khodam" on khodam for all using (true) with check (true);

drop policy if exists "public read khodam_attendance" on khodam_attendance;
drop policy if exists "public write khodam_attendance" on khodam_attendance;
create policy "public read khodam_attendance" on khodam_attendance for select using (true);
create policy "public write khodam_attendance" on khodam_attendance for all using (true) with check (true);

-- 2) وسّع "حصة" لحد ٧ (لو مش موجودين أصلاً)
insert into activities (key, name, group_name, base_points, bonus_points)
select * from (values
  ('lesson_4', 'حصة ٤', 'حصة', 10, 20),
  ('lesson_5', 'حصة ٥', 'حصة', 10, 20),
  ('lesson_6', 'حصة ٦', 'حصة', 10, 20),
  ('lesson_7', 'حصة ٧', 'حصة', 10, 20)
) as v(key, name, group_name, base_points, bonus_points)
where not exists (select 1 from activities a where a.key = v.key);
