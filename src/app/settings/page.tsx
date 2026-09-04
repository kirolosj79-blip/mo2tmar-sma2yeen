"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import {
  fetchTeams,
  fetchActivities,
  fetchAdmins,
  fetchSettings,
  fetchParticipants,
  createTeam,
  deleteTeam,
  renameTeam,
  createActivity,
  updateActivity,
  deleteActivity,
  addAdmin,
  removeAdmin,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  resetAllScores,
} from "@/lib/queries";
import { useToast } from "@/hooks/useToast";
import { useStage, STAGE_OPTIONS } from "@/hooks/useStage";
import { TEAM_COLOR_CHOICES, STAGE_LABELS, uid } from "@/lib/utils";
import PasswordGate from "@/components/auth/PasswordGate";
import type { Team, Activity, Admin, AppSettings, Participant, Stage } from "@/lib/types";

export default function SettingsPage() {
  return (
    <PasswordGate storageKey="unlocked_settings">
      <SettingsContent />
    </PasswordGate>
  );
}

function SettingsContent() {
  const { toast } = useToast();
  const { stageKey } = useStage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [newTeamName, setNewTeamName] = useState("");
  const [newActivityName, setNewActivityName] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newParticipantName, setNewParticipantName] = useState<Record<string, string>>({});
  const [newParticipantStage, setNewParticipantStage] = useState<Record<string, Stage>>({});

  async function load() {
    // بنجيب كل المشاركين من كل المراحل دايمًا، عشان نعرضهم مقسمين حسب المرحلة تحت كل فريق
    // ونسمح بإضافة مشارك لأي مرحلة من هنا من غير ما نضطر نغيّر الفلتر العام فوق
    const [t, a, ad, s, p] = await Promise.all([
      fetchTeams(),
      fetchActivities(),
      fetchAdmins(),
      fetchSettings(),
      fetchParticipants(),
    ]);
    setTeams(t);
    setActivities(a);
    setAdmins(ad);
    setSettings(s);
    setParticipants(p);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const rosterByTeam = useMemo(() => {
    return teams.map((team) => ({ team, members: participants.filter((p) => p.team_id === team.id) }));
  }, [teams, participants]);

  async function handleAddTeam() {
    if (!newTeamName.trim()) return;
    const usedColors = teams.map((t) => t.color);
    const color = TEAM_COLOR_CHOICES.find((c) => !usedColors.includes(c)) ?? TEAM_COLOR_CHOICES[0];
    await createTeam(newTeamName.trim(), color);
    setNewTeamName("");
    toast("اتضاف الفريق", "success");
    load();
  }

  async function handleDeleteTeam(id: string) {
    if (!confirm("تمسح الفريق ده؟ المشاركين بتوعه هيبقوا بلا فريق.")) return;
    await deleteTeam(id);
    toast("اتمسح الفريق", "info");
    load();
  }

  async function handleRenameTeam(id: string, name: string) {
    await renameTeam(id, name);
    load();
  }

  async function handleAddActivity() {
    const name = newActivityName.trim();
    if (!name) return;
    // بنشتق اسم المجموعة أوتوماتيك من اسم النشاط (بنشيل أي رقم في الآخر) — عشان "حصة ٤" تتجمع مع "حصة ١/٢/٣" في تابات صفحة الحضور
    const group = name.replace(/[\s]*[0-9١٢٣٤٥٦٧٨٩٠]+$/u, "").trim() || name;
    await createActivity(uid("act"), name, group, 10, 20);
    setNewActivityName("");
    toast("اتضاف النشاط", "success");
    load();
  }

  async function handleDeleteActivity(key: string) {
    if (!confirm("هل أنت متأكد من حذف هذا النشاط؟")) return;
    await deleteActivity(key);
    toast("اتمسح النشاط", "info");
    load();
  }

  async function handleAddAdmin() {
    if (!newAdminName.trim()) return;
    await addAdmin(newAdminName.trim());
    setNewAdminName("");
    toast("اتضاف الأدمن", "success");
    load();
  }

  async function handleRemoveAdmin(id: string) {
    await removeAdmin(id);
    toast("اتشال الأدمن", "info");
    load();
  }

  async function handleResetAllScores() {
    if (!confirm("متأكد إنك عايز تصفّر كل الدرجات؟ ده هيمسح كل تسجيلات حضور الأنشطة، ويصفّر بونص كل فرد وكل فريق. الأسماء والفرق نفسها مش هتتمسح.")) return;
    if (!confirm("تأكيد أخير: مفيش رجوع في الخطوة دي. متأكد ١٠٠٪؟")) return;
    await resetAllScores();
    toast("اتصفّرت كل الدرجات", "success");
    load();
  }

  async function handleAddParticipant(teamId: string, stage: Stage) {
    const name = (newParticipantName[teamId] ?? "").trim();
    if (!name) return;
    await createParticipant(name, teamId, stage);
    setNewParticipantName((prev) => ({ ...prev, [teamId]: "" }));
    toast("اتضاف المشارك", "success");
    load();
  }

  async function handleRenameParticipant(id: string, name: string) {
    if (!name.trim()) return;
    await updateParticipant(id, { name: name.trim() });
    load();
  }

  async function handleMoveParticipant(id: string, teamId: string) {
    await updateParticipant(id, { team_id: teamId });
    toast("اتحدث الفريق", "success");
    load();
  }

  async function handleDeleteParticipant(id: string) {
    await deleteParticipant(id);
    toast("اتشال المشارك", "info");
    load();
  }

  if (loading || !settings) return <div className="text-textdim">جارِ التحميل…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
        <p className="mt-1 text-sm text-textdim">اظبط النقاط، والفرق، والأنشطة، والمشاركين</p>
      </div>

      <Card>
        <h2 className="mb-1 font-display font-bold">الأنشطة</h2>
        <p className="mb-3 text-xs text-textdim">
          حدد اسم كل نشاط، مجموعته (التاب اللي هيظهر تحته)، وترتيبه (رقم أصغر = بيظهر الأول) — بدل ما يبقى عشوائي.
          النشاط "متوقف" مش هيظهر في التابات لحد ما تفعّله تاني من هنا.
        </p>
        <div className="flex flex-col gap-2">
          {activities.map((a) => (
            <div
              key={a.key}
              className={`flex flex-wrap items-center gap-2 border-t border-border pt-2.5 first:border-none first:pt-0 ${
                a.is_active ? "" : "opacity-50"
              }`}
            >
              <input
                defaultValue={a.name}
                onBlur={(e) => updateActivity(a.key, { name: e.target.value })}
                className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-surface2"
              />
              <label className="text-xs text-textdim">المجموعة</label>
              <input
                defaultValue={a.group_name}
                onBlur={(e) => updateActivity(a.key, { group_name: e.target.value })}
                title="اسم التاب اللي النشاط ده هيتجمع تحته (مثلاً: حصة)"
                className="w-24 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-xs"
              />
              <label className="text-xs text-textdim">الترتيب</label>
              <input
                type="number"
                defaultValue={a.sort_order}
                onBlur={(e) => updateActivity(a.key, { sort_order: Number(e.target.value) })}
                title="رقم أصغر = بيظهر الأول. اضبطه زي ما عايز بدل ما يكون عشوائي"
                className="w-16 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-xs"
              />
              <label className="text-xs text-textdim">النقطة الأساسية</label>
              <input
                type="number"
                defaultValue={a.base_points}
                onBlur={(e) => updateActivity(a.key, { base_points: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-xs"
              />
              <label className="text-xs text-textdim">نقطة المكافأة</label>
              <input
                type="number"
                defaultValue={a.bonus_points}
                onBlur={(e) => updateActivity(a.key, { bonus_points: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-xs"
              />
              <button
                onClick={async () => {
                  await updateActivity(a.key, { is_active: !a.is_active });
                  load();
                }}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  a.is_active ? "border-border text-textdim" : "border-teal text-teal"
                }`}
              >
                {a.is_active ? "شغّال" : "متوقف — دوس عشان تفعّله"}
              </button>
              <button
                onClick={() => handleDeleteActivity(a.key)}
                className="rounded-lg border border-coral px-2.5 py-1.5 text-xs font-semibold text-coral"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newActivityName}
            onChange={(e) => setNewActivityName(e.target.value)}
            placeholder="اسم النشاط…"
            className="flex-1 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button onClick={handleAddActivity} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03]">
            ضيف نشاط
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-display font-bold">الفرق</h2>
        <p className="mb-3 text-xs text-textdim">أسماء الفرق العامة — بتتشارك بين كل المراحل</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div key={team.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                <input
                  defaultValue={team.name}
                  onBlur={(e) => handleRenameTeam(team.id, e.target.value)}
                  className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold hover:border-border hover:bg-surface2"
                />
                <span className="text-[11px] text-textdim">بونص: {team.bonus_pts}</span>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="rounded-lg border border-coral px-2.5 py-1 text-xs font-semibold text-coral"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="اسم الفريق الجديد…"
            className="flex-1 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button onClick={handleAddTeam} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03]">
            ضيف فريق
          </button>
        </div>
      </Card>

      {/* المشاركين */}
      <Card>
        <h2 className="mb-1 font-display font-bold">المشاركين</h2>
        <p className="mb-3 text-xs text-textdim">
          كل فريق تحته أعضاءه مقسمين حسب المرحلة. لما تضيف اسم جديد اختار مرحلته من جنب الاسم — مش لازم تغيّر
          الفلتر العام فوق.
        </p>
        <div className="flex flex-col gap-4">
          {rosterByTeam.map(({ team, members }) => {
            const byStage: Record<Stage, Participant[]> = {
              elementary: members.filter((m) => m.stage === "elementary"),
              preparatory: members.filter((m) => m.stage === "preparatory"),
              secondary: members.filter((m) => m.stage === "secondary"),
              university: members.filter((m) => m.stage === "university"),
            };
            const addStage = newParticipantStage[team.id] ?? (stageKey !== "all" ? stageKey : "preparatory");
            return (
              <div key={team.id} className="rounded-xl border border-border p-3.5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="font-display font-bold">{team.name}</span>
                  <span className="ms-auto text-xs text-textdim">{members.length} مشارك</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(["elementary", "preparatory", "secondary", "university"] as Stage[]).map((stage) => (
                    <div key={stage} className="rounded-lg bg-surface2 p-2.5">
                      <div className="mb-1.5 text-[11px] font-bold text-textdim">
                        {STAGE_LABELS[stage]} ({byStage[stage].length})
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {byStage[stage].map((p) => (
                          <div key={p.id} className="flex items-center gap-1">
                            <input
                              defaultValue={p.name}
                              onBlur={(e) => handleRenameParticipant(p.id, e.target.value)}
                              className="min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-border hover:bg-surface"
                            />
                            <select
                              value={p.team_id ?? ""}
                              onChange={(e) => handleMoveParticipant(p.id, e.target.value)}
                              title="انقل لفريق تاني"
                              className="w-14 shrink-0 rounded border border-transparent bg-transparent text-[10px] text-textdim hover:border-border"
                            >
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleDeleteParticipant(p.id)}
                              className="shrink-0 text-[11px] text-coral"
                              title="حذف"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {byStage[stage].length === 0 && <span className="text-[11px] text-textdim">—</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={newParticipantName[team.id] ?? ""}
                    onChange={(e) => setNewParticipantName((prev) => ({ ...prev, [team.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddParticipant(team.id, addStage)}
                    placeholder="اسم المشارك الجديد…"
                    className="flex-1 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
                  />
                  <select
                    value={addStage}
                    onChange={(e) =>
                      setNewParticipantStage((prev) => ({ ...prev, [team.id]: e.target.value as Stage }))
                    }
                    className="rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
                  >
                    {STAGE_OPTIONS.filter((s) => s.key !== "all").map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAddParticipant(team.id, addStage)}
                    className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03]"
                  >
                    إضافة اسم
                  </button>
                </div>
              </div>
            );
          })}
          {teams.length === 0 && <p className="py-6 text-center text-sm text-textdim">ضيف فريق الأول من فوق.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-display font-bold">الأدمنز</h2>
        <p className="mb-3 text-xs text-textdim">إدارة قائمة أسماء الأدمنز المتاحة عند إضافة النقاط الإضافية</p>
        <div className="flex flex-wrap gap-2">
          {admins.map((a) => (
            <span key={a.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
              {a.name}
              <button onClick={() => handleRemoveAdmin(a.id)} className="text-coral">
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            placeholder="اسم الأدمن…"
            className="flex-1 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button onClick={handleAddAdmin} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-[#241A03]">
            ضيف أدمن
          </button>
        </div>
      </Card>

      <Card className="border-coral/40">
        <h2 className="mb-1 font-display font-bold text-coral">منطقة خطر</h2>
        <p className="mb-3 text-xs text-textdim">
          تصفير كل الدرجات بيمسح كل تسجيلات حضور الأنشطة، ويصفّر بونص كل فرد وكل فريق — عشان تبدأ تسجيل النقط من
          جديد. الأسماء والفرق والمشاركين أنفسهم مش بيتمسحوا، بس مجموع نقاطهم بيرجع صفر.
        </p>
        <button onClick={handleResetAllScores} className="rounded-xl border border-coral px-4 py-2 text-sm font-bold text-coral">
          صفّر كل الدرجات
        </button>
      </Card>
    </div>
  );
}
