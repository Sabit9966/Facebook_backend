import { create } from 'zustand';
import { api } from '@/lib/api';

interface Ad {
    _id: string;
    advertiser_name: string;
    ad_description: string;
    scrape_date: string;
    keyword: string;
    phone?: string;
    address?: string;
    source?: string;
    advertiser_legal_name?: string;
    based_in_country?: string;
    image_url?: string;
    landing_url?: string;
}

interface Mission {
    _id: string;
    keyword: string;
    adsFound: number;
    newAds?: number;
    status: 'running' | 'completed' | 'failed' | 'stopped';
    startTime: string;
    endTime?: string;
    maxAdsPerRequest?: number;
    dailyLimit?: number;
    source?: string;
}

interface Scheduler {
    _id: string;
    keyword: string;
    cronExpression: string;
    isActive: boolean;
    maxAdsPerRequest: number;
    dailyLimit: number;
    lastRun?: string;
    nextRun?: string;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    createdAt: string;
    updatedAt: string;
}

interface ActiveMission {
    missionId: string;
    keyword: string;
    stats: {
        adsFound: number;
        newAds: number;
    };
}

interface AppState {
    ads: Ad[];
    keywords: string[];
    loading: boolean;
    adsError: string | null;
    missionsError: string | null;
    isScraping: boolean;
    activeMissions: ActiveMission[];
    currentKeyword: string | null;
    missions: Mission[];
    schedulers: Scheduler[];
    totalAds: number;
    currentPage: number;
    totalPages: number;
    limit: number;
    fetchAds: (page?: number, silent?: boolean) => Promise<void>;
    fetchAllAds: () => Promise<Ad[]>; // Added for export
    fetchKeywords: () => Promise<void>;
    fetchMissions: () => Promise<void>;
    fetchSchedulers: () => Promise<void>;
    fetchAdsByKeyword: (keyword: string) => Promise<Ad[]>;
    addKeyword: (keyword: string) => void;
    removeKeyword: (keyword: string) => void;
    triggerScrape: (keyword: string, maxAdsPerRequest?: number, dailyLimit?: number, filters?: any) => Promise<void>;
    stopScrape: (missionId?: string) => Promise<void>;
    fetchStatus: () => Promise<void>;
    scrapeStats: { adsFound: number; newAds: number };
    deleteAd: (id: string) => Promise<void>;
    deleteAds: (ids: string[]) => Promise<void>;
    deleteMission: (id: string) => Promise<void>;
    deleteMissions: (ids: string[]) => Promise<void>;
    createScheduler: (keyword: string, cronExpression: string, maxAdsPerRequest?: number, dailyLimit?: number) => Promise<void>;
    updateScheduler: (id: string, updates: Partial<Scheduler>) => Promise<void>;
    deleteScheduler: (id: string) => Promise<void>;
    setPage: (page: number) => void;
    reset: () => void;
}

export const useStore = create<AppState>((set, get) => ({
    ads: [],
    keywords: [],
    loading: false,
    adsError: null,
    missionsError: null,
    isScraping: false,
    activeMissions: [],
    currentKeyword: null,
    missions: [],
    schedulers: [],
    scrapeStats: { adsFound: 0, newAds: 0 },
    totalAds: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10,
    fetchAds: async (page = 1, silent = false) => {
        if (!silent) set({ loading: true, adsError: null });
        try {
            const limit = get().limit;
            const response = await api.get(`/api/ads?page=${page}&limit=${limit}`);
            set({
                ads: response.data.ads,
                totalAds: response.data.total,
                currentPage: response.data.page,
                totalPages: response.data.totalPages,
                loading: false,
                adsError: null
            });
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err && (err as { response?: { data?: { error?: string } } }).response?.data?.error
                ? (err as { response: { data: { error: string } } }).response.data.error
                : 'Failed to load ads';
            set({ loading: false, adsError: message });
        }
    },
    fetchAllAds: async () => {
        try {
            const response = await api.get('/api/ads?page=1&limit=100000');
            return response.data.ads ?? [];
        } catch (err) {
            console.error('Error fetching all ads:', err);
            return [];
        }
    },
    fetchKeywords: async () => {
        const doFetch = async (): Promise<void> => {
            const response = await api.get('/api/keywords');
            set({ keywords: response.data ?? [] });
        };
        try {
            await doFetch();
        } catch (err: unknown) {
            const status = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { status?: number } }).response?.status
                : 0;
            if (status === 500 || status === 503) {
                await new Promise((r) => setTimeout(r, 1500));
                try {
                    await doFetch();
                } catch (retryErr) {
                    console.error('Error fetching keywords (after retry):', retryErr);
                }
            } else {
                console.error('Error fetching keywords:', err);
            }
        }
    },
    fetchMissions: async () => {
        set({ missionsError: null });
        try {
            const response = await api.get('/api/missions');
            set({ missions: response.data ?? [], missionsError: null });
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err && (err as { response?: { data?: { error?: string } } }).response?.data?.error
                ? (err as { response: { data: { error: string } } }).response.data.error
                : 'Failed to load missions';
            set({ missionsError: message });
        }
    },
    fetchAdsByKeyword: async (keyword) => {
        try {
            const response = await api.get(`/api/ads/keyword/${encodeURIComponent(keyword)}`);
            return response.data ?? [];
        } catch (err) {
            console.error('Error fetching ads by keyword:', err);
            return [];
        }
    },
    addKeyword: (keyword) => set((state) => ({
        keywords: [...new Set([...state.keywords, keyword])]
    })),
    removeKeyword: (keyword) => set((state) => ({
        keywords: state.keywords.filter((kw) => kw !== keyword)
    })),
    triggerScrape: async (keyword, maxAdsPerRequest?: number, dailyLimit?: number, filters?: any) => {
        set({ isScraping: true });
        try {
            await api.post('/api/scrape', {
                keyword,
                maxAdsPerRequest,
                dailyLimit,
                filters
            });
        } catch (err) {
            console.error('Error triggering scrape:', err);
            set({ isScraping: false });
        }
    },
    stopScrape: async (missionId?: string) => {
        try {
            await api.post('/api/scrape/stop', { missionId });
            if (!missionId) {
                set({ isScraping: false, currentKeyword: null, activeMissions: [] });
            }
            get().fetchStatus();
        } catch (err) {
            console.error('Error stopping scrape:', err);
        }
    },
    fetchStatus: async () => {
        try {
            const response = await api.get('/api/scrape/status');
            const activeMissions = response.data.activeMissions || [];
            const stats = response.data.stats || { adsFound: 0, newAds: 0 };
            set({
                isScraping: response.data.isScraping,
                activeMissions: activeMissions,
                currentKeyword: activeMissions.length > 0 ? activeMissions[0].keyword : null,
                scrapeStats: stats
            });
        } catch (err) {
            console.error('Error fetching status:', err);
        }
    },
    deleteAd: async (id) => {
        try {
            await api.delete(`/api/ads/${id}`);
            set((state) => ({
                ads: state.ads.filter((ad) => ad._id !== id)
            }));
            const { fetchAds, currentPage } = get();
            await fetchAds(currentPage, true);
        } catch (err) {
            console.error('Error deleting ad:', err);
        }
    },
    deleteAds: async (ids) => {
        try {
            await api.post('/api/ads/batch-delete', { ids });
            set((state) => ({
                ads: state.ads.filter((ad) => !ids.includes(ad._id))
            }));
            const { fetchAds, currentPage } = get();
            await fetchAds(currentPage, true);
        } catch (err) {
            console.error('Error batch deleting ads:', err);
        }
    },
    deleteMission: async (id) => {
        try {
            await api.delete(`/api/missions/${id}`);
            set((state) => ({
                missions: state.missions.filter((mission) => mission._id !== id)
            }));
        } catch (err) {
            console.error('Error deleting mission:', err);
        }
    },
    deleteMissions: async (ids) => {
        try {
            await api.post('/api/missions/batch-delete', { ids });
            set((state) => ({
                missions: state.missions.filter((mission) => !ids.includes(mission._id))
            }));
        } catch (err) {
            console.error('Error batch deleting missions:', err);
        }
    },
    fetchSchedulers: async () => {
        try {
            const response = await api.get('/api/schedulers');
            set({ schedulers: response.data ?? [] });
        } catch (err) {
            console.error('Error fetching schedulers:', err);
        }
    },
    createScheduler: async (keyword, cronExpression, maxAdsPerRequest = 1000, dailyLimit = 5000) => {
        try {
            const response = await api.post('/api/schedulers', {
                keyword,
                cronExpression,
                maxAdsPerRequest,
                dailyLimit
            });
            set((state) => ({
                schedulers: [response.data, ...state.schedulers]
            }));
        } catch (err) {
            console.error('Error creating scheduler:', err);
            throw err;
        }
    },
    updateScheduler: async (id, updates) => {
        try {
            const response = await api.put(`/api/schedulers/${id}`, updates);
            set((state) => ({
                schedulers: state.schedulers.map(scheduler =>
                    scheduler._id === id ? response.data.scheduler : scheduler
                )
            }));
        } catch (err) {
            console.error('Update scheduler error:', err);
            throw err;
        }
    },
    deleteScheduler: async (id: string) => {
        try {
            await api.delete(`/api/schedulers/${id}`);
            set((state) => ({
                schedulers: state.schedulers.filter(scheduler => scheduler._id !== id)
            }));
        } catch (err) {
            console.error('Error deleting scheduler:', err);
        }
    },
    setPage: (page) => {
        set({ currentPage: page });
        get().fetchAds(page);
    },
    reset: () => set({
        ads: [],
        keywords: [],
        loading: false,
        adsError: null,
        missionsError: null,
        isScraping: false,
        activeMissions: [],
        currentKeyword: null,
        missions: [],
        schedulers: [],
        scrapeStats: { adsFound: 0, newAds: 0 },
        totalAds: 0,
        currentPage: 1,
        totalPages: 1,
    })
}));
