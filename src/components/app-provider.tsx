'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import catalog from '@/lib/catalogue-2027.json';
import { api, ApiError, type AppState, type Catalog, type VoteType } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from './auth-dialog';
const initial: AppState = { catalog: catalog as Catalog, user: null, personal: { votes: [], favorites: [], prediction: { Coro: [], Comparsa: [], Chirigota: [], Cuarteto: [] } }, rankings: { advanced: [], apto: [], aguja: [] }, counts: { votes: 0, participants: 0 }, serverTime: 0 };
type AuthMode = 'login' | 'register' | 'recover';
interface Context {
  state: AppState; loading: boolean; error: string; ready: boolean; authMode: AuthMode | null;
  openAuth: (mode?: AuthMode) => void; closeAuth: () => void; refresh: () => Promise<void>;
  mutate: <T = Record<string, unknown>>(path: string, method: string, body?: unknown) => Promise<T>;
  saveVote: (performanceId: string, type: VoteType, score: number, details?: unknown) => Promise<boolean>;
  favorite: (groupId: string) => Promise<void>; logout: () => Promise<void>;
}
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null); const sequence = useRef(0); const { toast } = useToast();
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try { const next = await api<AppState>('/api/state'); if (request === sequence.current) { setState(next); setError(''); setReady(true); } }
    catch (err) { if (request === sequence.current) setError((err as Error).message); }
    finally { if (request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = setInterval(update, 30000); document.addEventListener('visibilitychange', update);
    if (new URLSearchParams(window.location.search).has('admin')) setAuthMode('register');
    return () => { ++sequence.current; clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  const openAuth = useCallback((mode: AuthMode = 'login') => setAuthMode(mode), []);
  const mutate = useCallback(async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
    ++sequence.current;
    try { const result = await api<T>(path, method, body); await refresh(); return result; }
    catch (err) { if (err instanceof ApiError && err.status === 401 && err.code === 'authentication_required') { setState(s => ({ ...s, user: null, personal: initial.personal })); openAuth(); } throw err; }
  }, [refresh, openAuth]);
  const saveVote = async (performanceId: string, type: VoteType, score: number, details?: unknown) => {
    if (!state.user) { openAuth(); return false; }
    try { await mutate('/api/votes', 'POST', { performanceId, type, score, details }); toast({ title: 'Tu voto está guardado', description: 'Ya cuenta en los resultados de la comunidad.' }); return true; }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); if (err instanceof ApiError && err.status === 409) await refresh(); return false; }
  };
  const favorite = async (groupId: string) => {
    if (!state.user) { openAuth('register'); return; }
    try { await mutate('/api/favorites', 'PUT', { groupId, favorite: !state.personal.favorites.includes(groupId) }); }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
  };
  const logout = async () => {
    try { await api('/api/auth/logout', 'POST', {}); ++sequence.current; setState(s => ({ ...s, user: null, personal: initial.personal })); await refresh(); toast({ title: 'Sesión cerrada' }); }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
  };
  return <AppContext.Provider value={{ state, loading, ready, error, authMode, openAuth, closeAuth: () => setAuthMode(null), refresh, mutate, saveVote, favorite, logout }}>{children}<AuthDialog /></AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('AppProvider is required'); return context; }
