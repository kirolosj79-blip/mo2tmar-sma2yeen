"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStage, STAGE_OPTIONS } from "@/hooks/useStage";
import { useTheme } from "@/hooks/useTheme";

const NAV_ITEMS = [
  { href: "/dashboard", label: "لوحة العرض العامة", icon: "🖥️" },
  { href: "/leaderboard", label: "الترتيب العام", icon: "🏆" },
  { href: "/time", label: "الحضور", icon: "✅" },
  { href: "/attendance-report", label: "تحليل الحضور", icon: "📊" },
  { href: "/khodam", label: "الخدام", icon: "🙏" },
  { href: "/bonus", label: "النقاط الإضافية والتدقيق", icon: "🎁" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { stageKey, setStageKey } = useStage();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      {/* row 1: brand + nav + admin */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center rounded-[10px] border border-border p-2 text-base lg:hidden"
        >
          ☰
        </button>

        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="شعار مدرسة السماعيين" width={48} height={48} className="h-11 w-11 rounded-full bg-white object-cover ring-1 ring-border" />
          <div>
            <div className="text-[15px] font-extrabold leading-tight">مؤتمر تي ثيؤطوكوس</div>
            <div className="text-[10.5px] font-semibold text-textdim">كنائس زويلة</div>
          </div>
        </div>

        <nav className="ms-6 hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname?.startsWith(item.href) ? "bg-surface2 text-gold" : "text-textdim hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <span className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-textdim">
            Admin · Session
          </span>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "الوضع الفاتح" : "الوضع الغامق"}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* row 2: stage selector — بيفلتر كل الصفحات ماعدا لوحة العرض العامة (بتدور لوحدها على المراحل) */}
      {!pathname?.startsWith("/dashboard") && !pathname?.startsWith("/khodam") && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 md:px-6">
          <span className="text-xs font-bold text-textdim">المرحلة:</span>
          <div className="flex items-center gap-1 rounded-xl border border-border p-1">
            {STAGE_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setStageKey(s.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  stageKey === s.key ? "bg-gold text-[#241A03]" : "text-textdim"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-1 border-t border-border bg-surface px-4 pb-4 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
                pathname?.startsWith(item.href) ? "bg-surface2 text-gold" : "text-textdim"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
