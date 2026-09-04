import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/hooks/useToast";
import { StageProvider } from "@/hooks/useStage";
import { ThemeProvider } from "@/hooks/useTheme";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "مؤتمر تي ثيؤطوكوس · كنائس زويلة",
  description: "لوحة تحكم مؤتمر تفاعلية — فرق، حضور، أنشطة ونقاط إضافية",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="theme-dark">
        <ThemeProvider>
          <ToastProvider>
            <StageProvider>
              <AppShell>{children}</AppShell>
            </StageProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
