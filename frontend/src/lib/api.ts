import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

function createApiClient(): AxiosInstance {
    const client = axios.create({
        baseURL: API_BASE,
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
    });

    client.interceptors.request.use((config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    client.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                useAuthStore.getState().logout();
            }
            return Promise.reject(error);
        }
    );

    return client;
}

export const api = createApiClient();
export { API_BASE };
