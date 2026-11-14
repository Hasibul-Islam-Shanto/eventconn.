'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface AppState {
  theme: 'light' | 'dark' | 'system';
  saved: string[];
  setTheme: (theme: AppState['theme']) => void;
  toggleSaved: (id: string) => void;
}
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      saved: [],
      setTheme: (theme) => set({ theme }),
      toggleSaved: (id) =>
        set((state) => ({
          saved: state.saved.includes(id)
            ? state.saved.filter((value) => value !== id)
            : [...state.saved, id],
        })),
    }),
    { name: 'eventconn-preferences' },
  ),
);
