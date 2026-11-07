'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { useCompetitionResource } from '@/hooks/use-competition';
import { CompetitionIntro, CategoryTabs, ModuleGate, ResourceMessage } from './competition-ui';
import { normalizeText } from '@/lib/design';
import type { GroupCategory } from '@/lib/types';
import type { SupportData } from '@/lib/competition';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, Thermometer } from 'lucide-react';
import { categoryDesign } from '@/lib/design';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
export function SupportView() { return <ModuleGate module="support"><SupportContent /></ModuleGate>; }
function SupportContent() {
  const reduceMotion = useReducedMotion();
  const { state, mutate, openAuth } = useApp(); const resource = useCompetitionResource<SupportData>('/api/competition/support'); const { data } = resource; const [category, setCategory] = useState<GroupCategory>('Comparsa'); const [search, setSearch] = useState(''); const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  const selected = state.competition?.personal.support[category]; const votes = data?.votes.filter(v => v.category === category) || []; const leaders = votes.slice(0, 5);
  const chart = (data?.history || []).filter(h => h.category === category).map(h => ({ at: h.at, ...Object.fromEntries(leaders.map(l => [l.groupId, h.snapshot.find(g => g.groupId === l.groupId)?.votes ?? 0])) }));
  const colors = ['#3B84FA', '#C92168', '#FF7B2E', '#70AA30', '#9A7800'];
  const nameOf = (id?: string) => state.catalog.groups.find(g => g.id === id)?.name || '';
  const leader = votes[0]; const mine = votes.find(v => v.groupId === selected);
  const choose = async (group: { id: string; name: string }) => { if (!state.user) { openAuth('register'); return; } setBusy(group.id); setMessage(''); try { await mutate('/api/competition/support', 'PUT', { groupId: group.id }); setMessage(`Tu favorita es ${group.name}.`); resource.reload(); } catch (err) { setMessage((err as Error).message); } finally { setBusy(''); } };
  return <><CompetitionIntro title="Los favoritos del público" label="El termómetro antes del concurso" text="¿Quién crees que ganará? Una favorita por modalidad. Puedes cambiarla mientras el termómetro esté abierto." color="pink" /><ResourceMessage {...resource} />
    <div className="thermo-tabs"><CategoryTabs value={category} onChange={setCategory} /></div>
    <section className="thermo-hero" data-category={category}>
      <div className="thermo-gauge">
        <div className="thermo-tube" aria-hidden="true"><motion.span key={category} initial={{ scaleY: 0 }} animate={{ scaleY: (leader?.percentage ?? 0) / 100 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} /><i /></div>
        <div className="thermo-reading"><span className="mini-label"><Thermometer size={14} aria-hidden="true" /> {categoryDesign[category].plural}</span>{leader ? <><strong className="thermo-percent">{leader.percentage.toLocaleString('es')}<small>%</small></strong><p>Lidera <b>{nameOf(leader.groupId)}</b> con {leader.votes} {leader.votes === 1 ? 'voto' : 'votos'}.</p></> : <><strong className="thermo-percent">—</strong><p>La afición aún no ha hablado en esta modalidad.</p></>}</div>
      </div>
      <ol className="thermo-list" aria-label="Porcentaje de apoyo">{votes.slice(0, 6).map((vote, index) => <motion.li key={`${category}-${vote.groupId}`} className={vote.groupId === selected ? 'is-mine' : ''} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}><span className="thermo-pos">{index + 1}</span><div><strong>{nameOf(vote.groupId)}{vote.groupId === selected && <em> · tu favorita</em>}</strong><div className="thermo-bar"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: vote.percentage / 100 }} transition={{ duration: 0.9, delay: 0.1 + index * 0.05, ease: [0.22, 1, 0.36, 1] }} /></div></div><b>{vote.percentage.toLocaleString('es')}%</b></motion.li>)}{!votes.length && <li className="thermo-empty">Sin votos previos todavía.</li>}</ol>
      <aside className="thermo-side">
        <div className="thermo-pick"><span className="mini-label">Tu favorita</span>{selected ? <><strong>{nameOf(selected)}</strong><small>{mine ? `${mine.percentage.toLocaleString('es')}% del apoyo · ${mine.votes} ${mine.votes === 1 ? 'voto' : 'votos'}` : 'Elegida en esta modalidad'}</small></> : <><strong className="is-empty">Sin elegir</strong><small>Elige una agrupación abajo.</small></>}</div>
        <dl className="thermo-stats"><div><dt>Participantes</dt><dd>{data?.participants ?? '—'}</dd></div><div><dt>Votos en {categoryDesign[category].plural.toLowerCase()}</dt><dd>{data?.totals[category] ?? '—'}</dd></div><div><dt>Estado</dt><dd className={data?.window.open ? 'is-open' : ''}>{data?.window.open ? 'Abierto' : 'Cerrado'}</dd></div></dl>
        {data?.window.reason && <p className="small-note">{data.window.reason}</p>}
      </aside>
    </section>
    {message && <p className="service-notice" role="status">{message}</p>}
    <section className="thermo-picker"><div className="section-heading"><div><span className="mini-label">Elige tu favorita</span><h2>{categoryDesign[category].plural}</h2></div><label className="wide-search search-label"><span className="sr-only">Buscar favorita</span><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar una agrupación…" /></label></div>
      <div className="choice-grid">{state.catalog.groups.filter(g => g.category === category && normalizeText(g.name).includes(normalizeText(search))).map(group => { const pct = votes.find(v => v.groupId === group.id)?.percentage; return <motion.button whileTap={{ scale: 0.97 }} className={`choice-card ${selected === group.id ? 'is-selected' : ''}`} data-category={category} key={group.id} aria-pressed={selected === group.id} disabled={!data?.window.open || !!busy} onClick={() => { void choose(group); }}><span>{group.category}</span><strong>{group.name}</strong><small>{group.needsReview ? 'Nombre por revisar' : group.locality || 'COAC 2027'}</small><b>{busy === group.id ? 'Guardando…' : selected === group.id ? '♥ Tu favorita' : pct !== undefined ? `${pct.toLocaleString('es')}% · Elegir` : 'Elegir favorita'}</b></motion.button>; })}</div></section>
    <section className="chart-panel"><div className="panel-heading"><h2>Evolución del apoyo</h2><span>Recuentos reales · últimas mediciones por hora</span></div>{chart.length > 1 && leaders.length ? <><div className="data-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="4 6" vertical={false} /><XAxis dataKey="at" type="number" domain={['dataMin', 'dataMax']} tickFormatter={v => new Date(v).toLocaleDateString('es', { day: 'numeric', month: 'short' })} fontSize={12} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} /><Tooltip labelFormatter={v => new Date(Number(v)).toLocaleString('es')} />{leaders.map((leader, index) => <Line key={leader.groupId} dataKey={leader.groupId} name={nameOf(leader.groupId)} stroke={colors[index]} strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={!reduceMotion} animationDuration={1100} animationEasing="ease-out" />)}</LineChart></ResponsiveContainer></div><div className="chart-legend">{leaders.map((l, i) => <span key={l.groupId}><i style={{ background: colors[i] }} />{nameOf(l.groupId)}</span>)}</div></> : <p className="chart-empty">Necesitamos votos registrados en al menos dos momentos distintos para mostrar la evolución.</p>}</section>
    <section className="chart-panel"><div className="panel-heading"><h2>Del pronóstico a la actuación</h2></div><p className="small-note mt-3">El apoyo previo es distinto de la valoración del repertorio. Estas medias proceden de las votaciones avanzadas durante el concurso.</p>{state.rankings.advanced.filter(g => g.category === category).length ? <div className="comparison-during">{state.rankings.advanced.filter(g => g.category === category).slice(0, 10).map(g => <div key={g.groupId}><strong>{g.groupName}</strong><span>{g.averageScore.toFixed(2)} puntos · {g.voteCount} votos</span></div>)}</div> : <p className="chart-empty">Todavía no hay puntuaciones de actuaciones en esta modalidad.</p>}</section>
  </>;
}
