"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store";

/**
 * Manually triggers zustand-persist's rehydration from localStorage after
 * mount (the store is created with skipHydration: true for this reason).
 * Doing it here — post-hydration, inside an effect — instead of letting
 * persist read localStorage synchronously during store creation is what
 * keeps the client's first render identical to the server-rendered HTML.
 */
export default function StoreHydration() {
  useEffect(() => {
    Promise.resolve(useAuthStore.persist.rehydrate()).finally(() => {
      useAuthStore.getState().setHasHydrated(true);
    });
  }, []);

  return null;
}
