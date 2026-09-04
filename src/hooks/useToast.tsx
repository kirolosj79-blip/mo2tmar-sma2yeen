"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "info" | "success" | "warn";
interface ToastItem {
  id: string;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  toast: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: Tone = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 left-5 z-[200] flex w-80 flex-col gap-2">
        {items.map((i) => (
          <div
            key={i.id}
            className="flex animate-[slideIn_.25s_ease] items-start gap-2.5 rounded-xl border border-border bg-surface2 p-3 text-sm shadow-lg"
          >
            <span
              className={
                i.tone === "warn" ? "text-coral" : i.tone === "success" ? "text-teal" : "text-gold"
              }
            >
              ●
            </span>
            <span>{i.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
