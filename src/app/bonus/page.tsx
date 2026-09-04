"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { fetchTeams, fetchParticipants, fetchAdmins, fetchBonusLog, fetchSettings, bulkApplyPoints, addBonusPoints } from "@/lib/queries";
import { useToast } from "@/hooks/useToast";
import { useStage } from "@/hooks/useStage";
import type { Team, Participant, Admin, BonusLogEntry, AppSettings } from "@/lib/types";

export default function BonusPage() {
  const { toast } = useToast();
  const { stageKey } = useStage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [log, setLog] = useState<BonusLogEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [targetType, setTargetType] = useState<"participant" | "team">("participant");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [participantSearch, setParticipantSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [points, setPoints] = useState(5);
  const [admin, setAdmin] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  async function load() {
    const stage = stageKey === "all" ? undefined : stageKey;
    const [t, p, a, l, s] = await Promise.all([
      fetchTeams(),
      fetchParticipants(stage),
      fetchAdmins(),
      fetchBonusLog(),
      fetchSettings(),
    ]);
    setTeams(t);
    setParticipants(p);
    setAdmins(a);
    setLog(l);
    setSettings(s);
    setAdmin(a[0]?.name ?? "");
    setTeamId(t[0]?.id ?? "");
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) return participants;
    return participants.filter((p) => p.name.includes(participantSearch.trim()));
  }, [participants, participantSearch]);

  function toggleParticipant(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!admin.trim()) return setError("من فضلك اكتب اسم الأدمن");
    if (targetType === "participant" && selectedIds.size === 0) return setError("من فضلك اختار مشارك واحد على الأقل");
    setError("");

    const flagged = Math.abs(points) >= (settings?.bonus_threshold ?? 15);

    if (targetType === "participant") {
      // نفس النقطة بتتوزع على كل المشاركين المحددين مرة واحدة، وكل واحد نقطته منفصلة عن التاني تمامًا
      await bulkApplyPoints(
        Array.from(selectedIds).map((id) => ({ participantId: id, points })),
        "",
        admin,
        date,
        settings?.bonus_threshold ?? 15
      );
    } else {
      // بونص الفريق بيتسجل على الفريق نفسه بس — مش بيلمس نقط أي فرد فيه
      await addBonusPoints({ targetType: "team", teamId, points, reason: "", admin, date, flagged });
    }

    toast(flagged ? "نقاط كبيرة اتسجلت للمراجعة" : "النقاط الإضافية اتسجلت", "success");
    setSelectedIds(new Set());
    await load();
  }

  if (loading) return <div className="text-textdim">جارِ التحميل…</div>;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">النقاط الإضافية والتدقيق</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_3fr]">
        <Card>
          <h2 className="mb-3 font-display font-bold">إضافة نقاط</h2>

          <label className="mb-1 mt-2 block text-xs font-bold text-textdim">اديها لـ</label>
          <div className="flex gap-2">
            <button
              onClick={() => setTargetType("participant")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                targetType === "participant" ? "border-gold bg-gold/10 text-gold" : "border-border text-textdim"
              }`}
            >
              مشارك / أفراد
            </button>
            <button
              onClick={() => setTargetType("team")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                targetType === "team" ? "border-gold bg-gold/10 text-gold" : "border-border text-textdim"
              }`}
            >
              فريق (جماعي)
            </button>
          </div>

          {targetType === "participant" ? (
            <>
              <label className="mb-1 mt-3 block text-xs font-bold text-textdim">
                اختار مشارك أو أكتر — كل واحد ياخد نفس النقطة، منفصلة عن بعضها
              </label>
              <input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="دور على اسم…"
                className="mb-2 w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
              />
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                {filteredParticipants.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-none hover:bg-surface2"
                  >
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleParticipant(p.id)} />
                    {p.name}
                  </label>
                ))}
                {filteredParticipants.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-textdim">مفيش نتائج</div>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div className="mt-2 text-xs text-textdim">{selectedIds.size} مشارك محدد</div>
              )}
            </>
          ) : (
            <>
              <label className="mb-1 mt-3 block text-xs font-bold text-textdim">فريق</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (بونص حالي: {t.bonus_pts})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-textdim">النقطة دي هتتسجل على الفريق نفسه بس — مش هتتوزع على الأفراد.</p>
            </>
          )}

          <label className="mb-1 mt-3 block text-xs font-bold text-textdim">إضافة ولا خصم؟</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPoints((p) => Math.abs(p))}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                points >= 0 ? "border-teal bg-teal/10 text-teal" : "border-border text-textdim"
              }`}
            >
              إضافة (+)
            </button>
            <button
              onClick={() => setPoints((p) => -Math.abs(p))}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                points < 0 ? "border-coral bg-coral/10 text-coral" : "border-border text-textdim"
              }`}
            >
              خصم (-)
            </button>
          </div>

          <label className="mb-1 mt-3 block text-xs font-bold text-textdim">عدد النقاط</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-textdim">
            {points < 0 ? `هيتخصم ${Math.abs(points)} نقطة` : `هيتضاف ${points} نقطة`}
          </p>

          <label className="mb-1 mt-3 block text-xs font-bold text-textdim">التاريخ</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          />

          <label className="mb-1 mt-3 block text-xs font-bold text-textdim">اسم الأدمن</label>
          <select
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm"
          >
            {admins.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>

          {error && <p className="mt-2 text-xs text-coral">{error}</p>}

          <button onClick={handleSubmit} className="mt-4 w-full rounded-xl bg-gold py-2.5 text-sm font-bold text-[#241A03]">
            أضف النقاط
          </button>
        </Card>

        <Card>
          <h2 className="mb-3 font-display font-bold">سجل التدقيق</h2>
          <div className="flex flex-col gap-2.5">
            {log.map((entry) => {
              const targetName =
                entry.target_type === "participant"
                  ? participants.find((p) => p.id === entry.participant_id)?.name ?? "—"
                  : teams.find((t) => t.id === entry.team_id)?.name ?? "—";
              return (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3.5">
                  <div className="text-sm">
                    <span className="font-bold">{entry.admin}</span> منح{" "}
                    <span className="font-bold text-gold">+{entry.points}</span> نقطة لـ{" "}
                    <span className="font-bold">{targetName}</span>
                    {entry.target_type === "team" && <span className="text-xs text-textdim"> (بونص فريق)</span>}
                    {" "}في {entry.log_date}
                    {entry.reason && <div className="mt-1 text-xs text-textdim">{entry.reason}</div>}
                  </div>
                  {entry.flagged && (
                    <span className="rounded-full bg-coral/15 px-2 py-1 text-[10px] font-bold text-coral">
                      نقاط كبيرة
                    </span>
                  )}
                </div>
              );
            })}
            {log.length === 0 && <div className="py-6 text-center text-sm text-textdim">لا يوجد سجل بعد</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
