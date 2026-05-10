"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── shared fetch helper ────────────────────────────────────────────────────
async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || `API error ${res.status}`);
  }
  return res.json();
}

// ─── KEYS ───────────────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  batches: (params?: Record<string, string>) =>
    params ? ["batches", params] : ["batches"],
  batch: (id: string | number) => ["batches", String(id)],
  sales: (params?: Record<string, string>) =>
    params ? ["sales", params] : ["sales"],
  adjustments: (params?: Record<string, string>) =>
    params ? ["adjustments", params] : ["adjustments"],
  users: (params?: Record<string, string>) =>
    params ? ["users", params] : ["users"],
  notifications: () => ["notifications"],
  schemes: () => ["schemes"],
  dashboard: () => ["dashboard"],
  quotas: () => ["quotas"],
} as const;

// ─── BATCHES ────────────────────────────────────────────────────────────────
export function useBatches(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== "all"))
  ).toString();

  return useQuery<any[]>({
    queryKey: QUERY_KEYS.batches(params),
    queryFn: () => apiFetch<any[]>(`/api/batches${qs ? `?${qs}` : ""}`),
    refetchInterval: 60_000, // background poll every 60 s
  });
}

// ─── SALES ──────────────────────────────────────────────────────────────────
export function useSales(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== "all"))
  ).toString();

  return useQuery<any[]>({
    queryKey: QUERY_KEYS.sales(params),
    queryFn: () => apiFetch<any[]>(`/api/sales${qs ? `?${qs}` : ""}`),
    refetchInterval: 60_000,
  });
}

// ─── ADJUSTMENTS ────────────────────────────────────────────────────────────
export function useAdjustments(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== "all"))
  ).toString();

  return useQuery<any[]>({
    queryKey: QUERY_KEYS.adjustments(params),
    queryFn: () => apiFetch<any[]>(`/api/adjustments${qs ? `?${qs}` : ""}`),
    refetchInterval: 60_000,
  });
}

// ─── USERS ──────────────────────────────────────────────────────────────────
export function useUsers() {
  return useQuery<any[]>({
    queryKey: QUERY_KEYS.users(),
    queryFn: () => apiFetch<any[]>(`/api/users?t=${Date.now()}`),
    staleTime: 60_000,
  });
}

// ─── SCHEMES ────────────────────────────────────────────────────────────────
export function useSchemes() {
  return useQuery<any[]>({
    queryKey: QUERY_KEYS.schemes(),
    queryFn: () => apiFetch<any[]>("/api/schemes"),
    staleTime: 5 * 60_000, // schemes change rarely — 5 min cache
  });
}

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
export function useNotifications() {
  return useQuery<any[]>({
    queryKey: QUERY_KEYS.notifications(),
    queryFn: () => apiFetch<any[]>("/api/notifications"),
    refetchInterval: 30_000, // poll every 30 s for near-realtime badge
  });
}

export function useUnreadCount() {
  const { data = [] } = useNotifications();
  return (data as any[]).filter((n) => !n.is_read).length;
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery<any>({
    queryKey: QUERY_KEYS.dashboard(),
    queryFn: () => apiFetch<any>("/api/dashboard"),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ─── QUOTAS ─────────────────────────────────────────────────────────────────
export function useQuotas() {
  return useQuery<any[]>({
    queryKey: QUERY_KEYS.quotas(),
    queryFn: () => apiFetch<any[]>("/api/quotas"),
    staleTime: 60_000,
  });
}

// ─── INVALIDATION HELPERS ────────────────────────────────────────────────────
/**
 * Call after any mutation that affects batches (create, approve, pay, delete).
 */
export function useInvalidateBatches() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["batches"] });
}

export function useInvalidateSales() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["sales"] });
}

export function useInvalidateAdjustments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["adjustments"] });
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["users"] });
}

// ─── MUTATION: mark notification read ───────────────────────────────────────
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark all read");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
