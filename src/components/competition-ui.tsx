'use client';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useApp } from './app-provider';
import { LoadingView } from './motion';
import type { GroupCategory } from '@/lib/types';
import type { Traffic, CompetitionConfig } from '@/lib/competition';
import { categoryOrder, categoryDesign } from '@/lib/design';
export function CompetitionIntro({ title, label, text, color = 'blue', children }: { title: string; label: string; text: string; color?: string; children?: ReactNode }) { return <section className={`page-intro intro-${color}`}><div><span className="mini-label">{label}</span><h1>{title}</h1><p>{text}</p></div>{children}</section>; }
export function CategoryTabs({ value, onChange }: { value: GroupCategory; onChange: (value: GroupCategory) => void }) { return <div className="category-filters" aria-label="Modalidad">{categoryOrder.map(cat => <button key={cat} className={`category-filter ${value === cat ? 'selected' : ''}`} data-category={cat} aria-pressed={value === cat} onClick={() => onChange(cat)}>{categoryDesign[cat].plural}</button>)}</div>; }
export function ResourceMessage({ error, loading, reload }: { error: string; loading: boolean; reload?: () => void }) { return error ? <div className="service-notice" role="alert"><span>{error}</span>{reload && <button onClick={reload}>Reintentar</button>}</div> : loading ? <LoadingView label="Cargando datos…" cards={0} /> : null; }
export function TrafficBadge({ traffic, compact = false }: { traffic?: Traffic; compact?: boolean }) { if (!traffic) return <span className="traffic-badge" data-level="insufficient">Sin votos suficientes</span>; return <span className="traffic-badge" data-level={traffic.level} title={traffic.value === null ? `Se necesitan ${traffic.minimum} votos del mismo tipo` : `Valoración popular ${traffic.value}% · ${traffic.count} votos`}><span aria-hidden="true" />{traffic.label}{!compact && <small> · {traffic.count} {traffic.count === 1 ? 'voto' : 'votos'}</small>}</span>; }
export function ModuleGate({ module, children }: { module: keyof CompetitionConfig['modules']; children: ReactNode }) { const { state, error, refresh } = useApp(); if (state.competition?.config.modules[module] === false) return <div className="empty-state"><h1>Módulo desactivado</h1><p>Administración ha desactivado temporalmente esta sección.</p></div>; if (!state.competition) return <ResourceMessage error={error} loading={!error} reload={() => { void refresh(); }} />; return <>{children}</>; }
export function formatDate(value: string | number) { return new Date(value).toLocaleString('es', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' }); }
export interface PodiumEntry { key: string; position: number; name: string; value: string; unit?: string; detail?: string; highlight?: boolean }
/** Podio de competición para los tres primeros puestos (datos reales, nunca de relleno). */
export function Podium({ entries, label }: { entries: PodiumEntry[]; label: string }) {
  const top = entries.filter(e => e.position <= 3).slice(0, 3); if (!top.length) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean) as PodiumEntry[];
  return <ol className="podium" aria-label={label}>{order.map(entry => <motion.li key={entry.key} className={`podium-step step-${entry.position} ${entry.highlight ? 'is-mine' : ''}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: entry.position === 1 ? 0.05 : entry.position === 2 ? 0.15 : 0.25, ease: [0.22, 1, 0.36, 1] }}>
    <span className="podium-medal" aria-label={`Puesto ${entry.position}`}>{entry.position}º</span>
    <strong className="podium-name">{entry.name}</strong>
    <span className="podium-value">{entry.value}{entry.unit && <small>{entry.unit}</small>}</span>
    {entry.detail && <small className="podium-detail">{entry.detail}</small>}
    <i className="podium-base" aria-hidden="true" />
  </motion.li>)}</ol>;
}
