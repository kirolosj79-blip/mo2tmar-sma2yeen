-- ============================================================
-- Migration 008 — فصل جلسات الخدام تمامًا عن جلسات المشاركين.
-- ده بيصلح باجين حقيقيين كانوا موجودين:
--   ١) نسبة الحضور في الترتيب العام كانت بتتحسب غلط لأن جلسات
--      الخدام كانت بتتحسب ضمن إجمالي جلسات المشاركين.
--   ٢) قفل جلسة من صفحة الخدام كان بيقفلها كمان عند المشاركين
--      (لأنها نفس الصف حرفيًا في قاعدة البيانات).
-- آمن يتشغل على قاعدة فيها بيانات حقيقية — مش هيمسح بيانات المشاركين.
-- ============================================================

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

alter table khodam_sessions enable row level security;
drop policy if exists "public read khodam_sessions" on khodam_sessions;
drop policy if exists "public write khodam_sessions" on khodam_sessions;
create policy "public read khodam_sessions" on khodam_sessions for select using (true);
create policy "public write khodam_sessions" on khodam_sessions for all using (true) with check (true);

-- شيل الـ foreign key القديم بتاع khodam_checkins (كان بيربطها بـ activity_sessions) الأول،
-- قبل ما ننقل البيانات، عشان الـ update اللي جاي متتصدملوش بيه
alter table khodam_checkins drop constraint if exists khodam_checkins_session_id_fkey;

-- رحّل أي جلسات وتسجيلات حضور خدام قديمة كانت متسجلة على activity_sessions (المشتركة) لجلسات
-- خدام مستقلة جديدة، عشان محدش يفقد بيانات حضور الخدام اللي كانت موجودة
do $$
declare
  old_session record;
  new_session_id uuid;
begin
  for old_session in
    select distinct s.id as old_id, s.activity_key, s.session_date, s.session_no, s.started_at, s.locked
    from activity_sessions s
    where exists (select 1 from khodam_checkins kc where kc.session_id = s.id)
  loop
    insert into khodam_sessions (activity_key, session_date, session_no, started_at, locked)
    values (old_session.activity_key, old_session.session_date, old_session.session_no, old_session.started_at, old_session.locked)
    on conflict (activity_key, session_date, session_no) do update set locked = excluded.locked
    returning id into new_session_id;

    update khodam_checkins set session_id = new_session_id where session_id = old_session.old_id;
  end loop;
end $$;

-- دلوقتي بعد النقل، ضيف الـ foreign key الجديد اللي بيربط khodam_checkins بـ khodam_sessions
alter table khodam_checkins add constraint khodam_checkins_session_id_fkey
  foreign key (session_id) references khodam_sessions(id) on delete cascade;
