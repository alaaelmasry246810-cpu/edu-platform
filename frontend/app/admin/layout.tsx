"use client";
import Sidebar from "@/components/layout/Sidebar";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const { dir } = useI18n();

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 p-8 overflow-auto ${dir === "rtl" ? "mr-64" : "ml-64"}`}>
        {children}
      </main>
    </div>
  );
}
