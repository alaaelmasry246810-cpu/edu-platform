import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  status: string;
  plan: string;
  pages_uploaded_this_month: number;
  questions_generated_today: number;
  subscription_expires_at?: string | null;
  must_change_password?: boolean;
  teacher_features?: Record<string, boolean> | null;
  channel_links?: { label: string; url: string }[] | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
  isAdmin: () => boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      hasHydrated: false,
      setAuth: (user, token) => {
        localStorage.setItem("access_token", token);
        set({ user, accessToken: token });
      },
      updateUser: (patch) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...patch } });
      },
      logout: () => {
        localStorage.removeItem("access_token");
        set({ user: null, accessToken: null });
      },
      isAdmin: () => get().user?.role === "admin",
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "auth-store",
      // Rehydration from localStorage is triggered manually (see
      // StoreHydration.tsx) after mount, instead of synchronously during
      // store creation — on the client's very first render this keeps the
      // store's state identical to the server-rendered HTML (user: null),
      // which is what avoids the React hydration-mismatch errors (#418/#423)
      // that a synchronous localStorage read would otherwise cause.
      skipHydration: true,
    }
  )
);
