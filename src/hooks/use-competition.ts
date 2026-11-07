'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/app-provider';
export function useCompetitionResource<T>(path: string | null) {
  const { state } = useApp(); const [data, setData] = useState<T | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(!!path); const [tick, setTick] = useState(0); const generation = useRef(0);
  const identity = `${state.user?.id || 'guest'}:${path || ''}`;
  const [loadedIdentity, setLoadedIdentity] = useState('');
  useEffect(() => {
    const current = ++generation.current;
    if (loadedIdentity !== identity) { setData(null); setLoading(!!path); }
    if (!path) { setLoading(false); setLoadedIdentity(identity); return; }
    setError('');
    api<T>(path).then(result => { if (current === generation.current) { setData(result); setLoadedIdentity(identity); } }).catch(err => { if (current === generation.current) { setError(err.message); setLoadedIdentity(identity); } }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { ++generation.current; };
  }, [path, identity, state.serverTime, tick]);
  const reload = useCallback(() => setTick(value => value + 1), []);
  return { data: loadedIdentity === identity ? data : null, error: loadedIdentity === identity ? error : '', loading: loadedIdentity !== identity ? !!path : loading, reload };
}
