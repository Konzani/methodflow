import { create } from "zustand";

export type UpgradeReason = "limit" | "watermark" | "feature" | null;

interface UpgradeState {
  isOpen: boolean;
  reason: UpgradeReason;
  open: (reason: UpgradeReason) => void;
  close: () => void;
}

export const useUpgradeStore = create<UpgradeState>((set) => ({
  isOpen: false,
  reason: null,
  open: (reason) => set({ isOpen: true, reason }),
  close: () => set({ isOpen: false, reason: null }),
}));