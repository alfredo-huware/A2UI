import { create } from "zustand";

const KEY = "agui.settings.v1";

interface Settings {
  agentUrl: string;
  useMock: boolean;
  set: (patch: Partial<Pick<Settings, "agentUrl" | "useMock">>) => void;
}

const defaults = {
  agentUrl: (import.meta.env.VITE_AGENT_URL as string | undefined) ?? "http://localhost:8000/agent",
  useMock: false,
};

function load(): typeof defaults {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...defaults, ...JSON.parse(raw) }; } catch { /* */ }
  return defaults;
}

export const useSettings = create<Settings>((set) => ({
  ...load(),
  set: (patch) => set((prev) => {
    const next = { ...prev, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify({ agentUrl: next.agentUrl, useMock: next.useMock })); } catch { /* */ }
    return next;
  }),
}));
