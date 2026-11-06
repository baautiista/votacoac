'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/app-provider';
export function useCompetitionResource<T>(path: string | null) {
  const { state } = useApp(); const [data, setData] = useState<T | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(!!path); const [tick, setTick] = useState(0); const generation = useRef(0);
  useEffect(() => { const current = ++generation.current; if (!path) { setLoading(false); return; } setError(''); api<T>(path).then(result => { if (current === generation.current) setData(result); }).catch(err => { if (current === generation.current) setError(err.message); }).finally(() => { if (current === generation.current) setLoading(false); }); return () => { ++generation.current; }; }, [path, state.serverTime, tick]);
  const reload = useCallback(() => setTick(value => value + 1), []);
  return { data, error, loading, reload };
}
