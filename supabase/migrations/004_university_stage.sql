-- ============================================================
-- Migration 004 — إضافة مرحلة "جامعة" لقائمة المراحل
-- آمن يتشغل على قاعدة فيها بيانات حقيقية — مش هيمسح ولا نقطة.
-- ============================================================

alter table participants drop constraint if exists participants_stage_check;
alter table participants add constraint participants_stage_check
  check (stage in ('elementary', 'preparatory', 'secondary', 'university'));
