"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Stage } from "@/lib/types";

export type StageKey = Stage | "all";

interface StageContextValue {
  stageKey: StageKey;
  setStageKey: (s: StageKey) => void;
}

const StageContext = createContext<StageContextValue | null>(null);

export const STAGE_OPTIONS: { key: StageKey; label: string }[] = [
  { key: "elementary", label: "ابتدائي" },
  { key: "preparatory", label: "إعدادي" },
  { key: "secondary", label: "ثانوي" },
  { key: "university", label: "جامعة" },
  { key: "all", label: "كل المراحل" },
];

export function StageProvider({ children }: { children: ReactNode }) {
  const [stageKey, setStageKey] = useState<StageKey>("secondary");
  return <StageContext.Provider value={{ stageKey, setStageKey }}>{children}</StageContext.Provider>;
}

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStage must be used within a StageProvider");
  return ctx;
}
