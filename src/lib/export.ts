import * as XLSX from "xlsx";
import type { ParticipantTotals, Team } from "@/lib/types";
import { teamById } from "@/lib/utils";

export function exportLeaderboardExcel(rows: ParticipantTotals[], teams: Team[], filename = "leaderboard.xlsx") {
  const data = rows.map((p, i) => ({
    الترتيب: i + 1,
    المشارك: p.name,
    الفريق: teamById(teams, p.team_id)?.name ?? "—",
    الحضور: p.activity_points,
    إضافية: p.bonus_pts,
    المجموع: p.total_points,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الترتيب العام");
  XLSX.writeFile(wb, filename);
}

/**
 * Lightweight PDF export: opens a print-friendly window with a clean table
 * and triggers the browser's native "Save as PDF" print dialog. This avoids
 * pulling in a heavy PDF-generation library for a simple tabular export.
 */
export function exportLeaderboardPdf(rows: ParticipantTotals[], teams: Team[], title = "الترتيب العام") {
  const win = window.open("", "_blank");
  if (!win) return;

  const rowsHtml = rows
    .map(
      (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(teamById(teams, p.team_id)?.name ?? "—")}</td>
        <td>${p.activity_points}</td>
        <td>${p.bonus_pts}</td>
        <td><strong>${p.total_points}</strong></td>
      </tr>`
    )
    .join("");

  win.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        body { font-family: Tajawal, Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; }
        th { background: #f1f1f1; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead>
          <tr>
            <th>الترتيب</th><th>المشارك</th><th>الفريق</th><th>الحضور</th><th>إضافية</th><th>المجموع</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
  win.document.close();
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** تصدير عام لأي جدول بسيط (اسم عمود ← قيمة) لملف Excel */
export function exportTableExcel(rows: Record<string, string | number>[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** تصدير عام لأي جدول بسيط لملف PDF (عن طريق نافذة طباعة) */
export function exportTablePdf(rows: Record<string, string | number>[], title: string) {
  const win = window.open("", "_blank");
  if (!win || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const headHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyHtml = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(String(r[h]))}</td>`).join("")}</tr>`)
    .join("");

  win.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        body { font-family: Tajawal, Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; }
        th { background: #f1f1f1; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
  win.document.close();
}
