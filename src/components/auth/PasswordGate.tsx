"use client";

import { useEffect, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";

/**
 * حماية بسيطة بباسورد واحد للصفحات الحساسة (تحليل الحضور / الإعدادات).
 * الباسورد بييجي من NEXT_PUBLIC_APP_PASSWORD في .env.local — ده حماية بسيطة
 * على مستوى الواجهة بس، مش أمان حقيقي على مستوى السيرفر (الباسورد موجود في
 * كود المتصفح). كافي عشان تمنع أي حد يفتح الصفحة بالصدفة، مش كافي ضد شخص
 * محترف يفتح أدوات المطور. لو محتاج حماية أقوى، محتاجين Supabase Auth فعلي.
 */
export default function PasswordGate({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;
    if (saved === "1") setUnlocked(true);
    setChecked(true);
  }, [storageKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_APP_PASSWORD;
    if (input.length > 0 && expected && input === expected) {
      sessionStorage.setItem(storageKey, "1");
      setUnlocked(true);
      setError("");
    } else if (!expected) {
      setError("الباسورد مش متظبط لسه في إعدادات المشروع (NEXT_PUBLIC_APP_PASSWORD)");
    } else {
      setError("الباسورد غلط");
    }
  }

  if (!checked) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <h2 className="mb-1 text-center font-display text-lg font-bold">الصفحة دي محمية</h2>
        <p className="mb-4 text-center text-xs text-textdim">اكتب الباسورد عشان تدخل</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-center text-sm"
            placeholder="الباسورد"
          />
          {error && <p className="text-center text-xs text-coral">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-gold py-2.5 text-sm font-bold text-[#241A03]">
            دخول
          </button>
        </form>
      </Card>
    </div>
  );
}
