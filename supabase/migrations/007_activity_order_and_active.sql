-- ============================================================
-- Migration 007 — ترتيب الأنشطة حسب جدول اليوم الفعلي،
-- تفعيل/تعطيل نشاط (كلمة سيدنا مخفية افتراضيًا).
-- آمن يتشغل على قاعدة فيها بيانات حقيقية.
-- ============================================================

alter table activities add column if not exists sort_order int not null default 0;
alter table activities add column if not exists is_active boolean not null default true;

-- رتّب الأنشطة الموجودة حسب جدول اليوم: قداس → حصة١ → ورشة١ → ورشة٢ → حصة٢ → عشية → حصة٣ → تسبحة
update activities set sort_order = 1 where key = 'mass';
update activities set sort_order = 2 where key = 'lesson_1';
update activities set sort_order = 3 where key = 'workshop_1';
update activities set sort_order = 4 where key = 'workshop_2';
update activities set sort_order = 5 where key = 'lesson_2';
update activities set sort_order = 6 where key = 'vespers';
update activities set sort_order = 7 where key = 'lesson_3';
update activities set sort_order = 8 where key = 'tasbeha';
update activities set sort_order = 9 where key = 'father_word';

-- خبّي "كلمة سيدنا" لحد ما تفعّلها بنفسك من الإعدادات
update activities set is_active = false where key = 'father_word';
