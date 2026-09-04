-- ============================================================
-- Migration 003 — تجميع الأنشطة، بونص الفريق منفصل عن الأفراد،
-- نقطة قابلة للتعديل وقت بدء الجلسة، وإلغاء صفحة الحضور العام.
-- آمن يتشغل على قاعدة فيها بيانات حقيقية — مش هيمسح ولا نقطة.
-- ============================================================

-- 1) تجميع الأنشطة (عشان الحصة تتقسم حصة ١/٢/٣ والورشة ورشة ١/٢ في تابات)
alter table activities add column if not exists group_name text not null default '';

-- سمّي مجموعة الأنشطة الموجودة أصلاً
update activities set group_name = 'قداس' where key = 'mass' and group_name = '';
update activities set group_name = name where group_name = '' and key not in ('mass');

-- حوّل "الحصة" و"الورشة" القديمة لحصة ١ / ورشة ١ (بيانات الحضور القديمة بتوعهم تفضل زي ما هي)
update activities set name = 'حصة ١', group_name = 'حصة' where key = 'lesson';
update activities set name = 'ورشة ١', group_name = 'ورشة' where key = 'workshop';

-- ضيف الأنشطة الجديدة (لو مش موجودة أصلاً)
insert into activities (key, name, group_name, base_points, bonus_points)
select * from (values
  ('vespers', 'عشية', 'عشية', 10, 20),
  ('tasbeha', 'تسبحة', 'تسبحة', 10, 20),
  ('father_word', 'كلمة سيدنا', 'كلمة سيدنا', 10, 20),
  ('lesson_2', 'حصة ٢', 'حصة', 10, 20),
  ('lesson_3', 'حصة ٣', 'حصة', 10, 20),
  ('workshop_2', 'ورشة ٢', 'ورشة', 10, 20)
) as v(key, name, group_name, base_points, bonus_points)
where not exists (select 1 from activities a where a.key = v.key);

-- 2) بونص الفريق نفسه — منفصل تمامًا عن نقاط الأفراد
alter table teams add column if not exists bonus_pts int not null default 0;

-- رحّل أي بونص جماعي كان اتوزع على الأفراد قبل كده لحساب الفريق نفسه، وامسحه من الأفراد
-- (لو معملتش بونص جماعي قبل كده، السطرين دول مش هيعملوا حاجة)
do $$
declare
  t record;
  distributed_total int;
begin
  for t in select id from teams loop
    select coalesce(sum(bl.points), 0) into distributed_total
    from bonus_log bl
    where bl.target_type = 'team' and bl.team_id = t.id;

    if distributed_total <> 0 then
      update teams set bonus_pts = bonus_pts + distributed_total where id = t.id;
    end if;
  end loop;
end $$;

-- 3) نقطة قابلة للتحديد وقت بدء الجلسة (بدل القيمة الثابتة بس)
alter table activity_sessions add column if not exists points int;

-- 4) صفحة الحضور العام اتشالت من الواجهة — الأعمدة القديمة (general_present/general_points/general_order)
-- بتفضل موجودة في الجدول من غير ما تتمسح، عشان أي نقط حضور عام اتسجلت قبل كده تفضل محسوبة
-- في المجموع الكلي بتاع كل فرد ومحدش يخسر نقط. لو عايز تشيل الأعمدة دي نهائي بعد ما تتأكد إنك
-- مش محتاجها، شغّل الأسطر دي بنفسك (اختياري ومش لازم):
--   alter table participants drop column if exists general_present;
--   alter table participants drop column if exists general_points;
--   alter table participants drop column if exists general_order;

-- تحديث الـ view عشان يحسب النقط الفردية + general_points (تاريخي) + activity_points، من غير أي بونص فريق
create or replace view participant_totals as
select
  p.id,
  p.name,
  p.team_id,
  p.stage,
  coalesce(p.general_points, 0) as general_points,
  p.bonus_pts,
  coalesce(sum(c.points), 0) as activity_points,
  coalesce(p.general_points, 0) + p.bonus_pts + coalesce(sum(c.points), 0) as total_points
from participants p
left join activity_checkins c on c.participant_id = p.id
group by p.id;
