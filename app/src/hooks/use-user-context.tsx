"use client";

import { createContext, use } from "react";
import type { UserContext } from "@/lib/user-context";

const UserContextValue = createContext<UserContext | null>(null);

export function UserContextProvider({
  value,
  children,
}: {
  value: UserContext | null;
  children: React.ReactNode;
}) {
  return (
    <UserContextValue value={value}>
      {children}
    </UserContextValue>
  );
}

export function useUserContext(): UserContext {
  const ctx = use(UserContextValue);
  if (!ctx) throw new Error("useUserContext must be used within UserContextProvider");
  return ctx;
}

export function useOptionalUserContext(): UserContext | null {
  return use(UserContextValue);
}
