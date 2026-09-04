"use client";
import Sidebar from "@/components/layout/Sidebar";
import { useI18n } from "@/lib/i18n";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 p-8 overflow-auto ${dir === "rtl" ? "mr-64" : "ml-64"}`}>
        {children}
      </main>
    </div>
  );
}
