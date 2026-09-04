import Header from "@/components/layout/Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 p-5 md:p-6">{children}</main>
    </div>
  );
}
