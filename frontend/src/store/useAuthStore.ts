import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const AUTH_STORAGE_KEY = 'ad_intel_auth';

interface AuthState {
    token: string | null;
    userId: string | null;
    login: (token: string, userId: string) => void;
    logout: () => void;
    hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            userId: null,
            login: (token, userId) => set({ token, userId }),
            logout: () => set({ token: null, userId: null }),
            hydrate: () => {}
        }),
        { name: AUTH_STORAGE_KEY }
    )
);
