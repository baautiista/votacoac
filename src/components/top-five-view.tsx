'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import { useApp } from './app-provider';
import { useCompetitionResource } from '@/hooks/use-competition';
import { CompetitionIntro, ModuleGate, ResourceMessage, formatDate } from './competition-ui';
import { categoryDesign, categoryOrder, normalizeText } from '@/lib/design';
import { emptyPrediction, type TopFiveData } from '@/lib/competition';
import type { Prediction } from '@/lib/api';
import type { ActiveView, GroupCategory } from '@/lib/types';

const draftKey = 'votacoac-2027-top-five-draft';
export function TopFiveSummary({ onNavigate }: { onNavigate: (view: ActiveView) => void }) {
  const { state, openAuth } = useApp();
  const resource = useCompetitionResource<TopFiveData>(state.competition?.config.modules.predictions === false ? null : '/api/competition/top-five');
  if (state.competition?.config.modules.predictions === false) return null;
  return <section className="public-five-panel" aria-labelledby="public-five-title">
    <div className="section-heading"><div><span className="mini-label">La quiniela del público</span><h2 id="public-five-title">Las cinco que llegarán <span className="serif">más lejos.</span></h2><p>Así ve la afición cada modalidad. Tu quiniela también cuenta.</p></div><span className="five-participants">{resource.data ? `${resource.data.participants} quinielas guardadas` : 'Cargando quinielas…'}</span></div>
    <ResourceMessage {...resource} />
    <PublicFiveLists data={resource.data} />
    <div className="five-callout"><p>Elige cinco agrupaciones por modalidad. <strong>{state.user ? 'Tus aciertos se comprobarán con los resultados definitivos.' : 'Regístrate para ver si acertaste al terminar el concurso.'}</strong></p><button className="action-button action-blue" onClick={() => onNavigate('pronosticos')}>{state.user ? 'Ver mi quiniela' : 'Elegir mis cinco'}<ArrowRight size={17} /></button>{!state.user && <button className="text-link" onClick={() => openAuth('register')}>Registrarme</button>}</div>
  </section>;
}

function PublicFiveLists({ data }: { data: TopFiveData | null }) {
  const { state } = useApp();
  return <div className="public-five-grid">{categoryOrder.map(category => <section className="public-five-card" data-category={category} key={category}><header><span className="mini-label">La selección del público</span><h3>{categoryDesign[category].plural}</h3></header><ol>{Array.from({ length: 5 }, (_, index) => {
    const leader = data?.categories[category].leaders[index], group = state.catalog.groups.find(g => g.id === leader?.groupId);
    return <li key={leader?.groupId || index}><span className="five-place">{index + 1}</span><div><strong>{group?.name || (data ? 'Por decidir' : 'Cargando…')}</strong><small>{leader ? `${leader.votes} ${leader.votes === 1 ? 'selección' : 'selecciones'} · ${leader.percentage}% de quinielas` : 'La afición aún tiene que elegir'}</small></div></li>;
  })}</ol></section>)}</div>;
}

export function TopFiveView() { return <ModuleGate module="predictions"><TopFiveContent /></ModuleGate>; }
function TopFiveContent() {
  const { state, mutate, openAuth } = useApp();
  const resource = useCompetitionResource<TopFiveData>('/api/competition/top-five');
  const [selection, setSelection] = useState<Prediction>(emptyPrediction), [category, setCategory] = useState<GroupCategory>('Comparsa');
  const [search, setSearch] = useState(''), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const minimumSavedAt = useRef(0), previousUser = useRef(state.user?.id);
  useEffect(() => {
    if (previousUser.current && previousUser.current !== state.user?.id) { setDirty(false); minimumSavedAt.current = 0; setSelection(emptyPrediction()); }
    previousUser.current = state.user?.id;
  }, [state.user?.id]);
  useEffect(() => {
    if (!resource.data || dirty || (resource.data.savedAt || 0) < minimumSavedAt.current) return;
    if (resource.data.selection) { setSelection(resource.data.selection); return; }
    try {
      const stored = JSON.parse(localStorage.getItem(draftKey) || 'null'), next = emptyPrediction();
      for (const cat of categoryOrder) next[cat] = Array.isArray(stored?.[cat]) ? [...new Set<string>(stored[cat])].filter(id => state.catalog.groups.some(g => g.id === id && g.category === cat)).slice(0, 5) : [];
      setSelection(next);
    } catch { setSelection(emptyPrediction()); }
  }, [resource.data, dirty, state.catalog.groups]);
  useEffect(() => { if (dirty) { try { localStorage.setItem(draftKey, JSON.stringify(selection)); } catch { /* La selección sigue disponible en esta página. */ } } }, [selection, dirty]);
  const count = categoryOrder.reduce((total, cat) => total + selection[cat].length, 0), complete = count === 20;
  const open = !!resource.data?.window.open;
  const choose = (id: string) => {
    setSelection(current => ({ ...current, [category]: current[category].includes(id) ? current[category].filter(value => value !== id) : current[category].length < 5 ? [...current[category], id] : current[category] }));
    setDirty(true); setMessage('');
  };
  const save = async () => {
    if (!state.user) { openAuth('register'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await mutate<{ savedAt: number }>('/api/competition/forecast', 'PUT', { phase: 'top5', selection });
      minimumSavedAt.current = result.savedAt; setDirty(false); setMessage('Quiniela guardada. Vuelve al terminar el concurso para comprobar tus aciertos.');
      try { localStorage.removeItem(draftKey); } catch { /* El guardado de la cuenta ya está confirmado. */ }
      resource.reload();
    } catch (error) { setMessage((error as Error).message); resource.reload(); } finally { setBusy(false); }
  };
  const checked = categoryOrder.filter(cat => resource.data?.categories[cat].checked);
  return <>
    <CompetitionIntro title="Las cinco del público" label="Tu quiniela, tu selección" text="¿Qué cinco agrupaciones de cada modalidad llegarán más lejos? Elígelas, guarda tu quiniela y comprueba tus aciertos al terminar el concurso." color="blue" />
    <ResourceMessage {...resource} />
    <PublicFiveLists data={resource.data} />
    <div className="five-overview-foot"><span>{resource.data?.participants ?? '—'} quinielas guardadas · cada persona elige cinco por modalidad.</span><span>Selecciones populares, sin relación con el jurado oficial.</span></div>
    {!state.user && <section className="five-register"><div><span className="mini-label">Que tu intuición quede guardada</span><h2>¿Y si <span className="serif">aciertas?</span></h2><p>Regístrate para ver si acertaste al terminar el concurso. Puedes preparar tu elección aquí antes de crear la cuenta.</p></div><button className="action-button action-yellow" onClick={() => openAuth('register')}>Registrarme gratis <ArrowRight size={17} /></button></section>}
    <section className="five-picker" aria-labelledby="five-picker-title">
      <header className="section-heading"><div><span className="mini-label">Tu pronóstico personal</span><h2 id="five-picker-title">Mis cinco <span className="serif">por modalidad.</span></h2><p>Selecciona cinco en cada una. El orden no cambia los aciertos.</p></div><span className="five-total" aria-live="polite">{count}<small>/20</small></span></header>
      <div className="five-category-progress">{categoryOrder.map(cat => <button key={cat} className={category === cat ? 'is-selected' : ''} data-category={cat} onClick={() => { setCategory(cat); setSearch(''); }} aria-pressed={category === cat}><strong>{categoryDesign[cat].plural}</strong><span>{selection[cat].length}/5</span></button>)}</div>
      {!open && resource.data && <p className="service-notice">{resource.data.window.reason}. Tu quiniela guardada se conserva.</p>}
      <div className="five-selected" aria-label={`Tus cinco ${categoryDesign[category].plural.toLowerCase()}`}>{Array.from({ length: 5 }, (_, i) => {
        const group = state.catalog.groups.find(g => g.id === selection[category][i]);
        return <div key={i} data-filled={!!group}><span>{String(i + 1).padStart(2, '0')}</span><strong>{group?.name || 'Tu próxima elección'}</strong>{group && <button aria-label={`Quitar ${group.name}`} disabled={!open || busy} onClick={() => choose(group.id)}>×</button>}</div>;
      })}</div>
      <label className="search-label five-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar agrupación o autor</span><input type="search" value={search} placeholder="Buscar agrupación o autor…" onChange={e => setSearch(e.target.value)} /></label>
      <div className="choice-grid five-choices">{state.catalog.groups.filter(g => g.category === category && normalizeText(`${g.name} ${g.author}`).includes(normalizeText(search))).map(group => {
        const selected = selection[category].includes(group.id);
        return <motion.button whileTap={{ scale: 0.98 }} key={group.id} type="button" className={`choice-card ${selected ? 'is-selected' : ''}`} data-category={category} aria-pressed={selected} disabled={!open || busy || (!selected && selection[category].length === 5)} onClick={() => choose(group.id)}><span>{group.category}</span><strong>{group.name}</strong><small>{group.author || group.locality || 'COAC 2027'}</small><b>{selected ? '✓ En mis cinco' : 'Añadir a mis cinco'}</b></motion.button>;
      })}</div>
      <div className="five-save-bar"><div><strong>{complete ? 'Tus veinte están listas.' : `Te quedan ${20 - count} agrupaciones por elegir.`}</strong><span>{dirty ? 'Cambios sin guardar en tu cuenta' : resource.data?.savedAt ? `Guardada el ${formatDate(resource.data.savedAt)}` : 'Tu elección aún no está guardada en una cuenta'}</span></div><button className="action-button action-blue" onClick={() => { void save(); }} disabled={busy || !open || (!!state.user && !complete)}>{busy ? 'Guardando…' : state.user ? 'Guardar mi quiniela' : 'Registrarme y guardar'}<ArrowRight size={17} /></button></div>
      {message && <p className="service-notice" role="status">{message}</p>}
    </section>
    {state.user && resource.data?.selection && <section className="five-results settings-panel"><div className="section-heading"><div><span className="mini-label">Tus resultados</span><h2>{checked.length ? 'Así va tu quiniela.' : 'Nos vemos al terminar.'}</h2></div><strong>{checked.length ? `${checked.reduce((sum, cat) => sum + (resource.data!.categories[cat].hits || 0), 0)}/${checked.length * 5} aciertos` : 'Resultados pendientes'}</strong></div><p>Los aciertos se comprueban con las cinco agrupaciones que más lejos llegaron, una vez que administración publique el resultado definitivo de cada modalidad. Cada acierto suma {resource.data.pointsPerHit} {resource.data.pointsPerHit === 1 ? 'punto' : 'puntos'} en la Liga.</p><div className="five-result-grid">{categoryOrder.map(cat => <div key={cat}><h3>{categoryDesign[cat].plural} <span>{resource.data!.categories[cat].checked ? `${resource.data!.categories[cat].hits}/5` : 'Pendiente'}</span></h3><ul>{resource.data!.selection![cat].map(id => <li key={id} data-hit={resource.data!.categories[cat].checked ? resource.data!.categories[cat].results.some(r => r.groupId === id) : undefined}>{state.catalog.groups.find(g => g.id === id)?.name}<span>{resource.data!.categories[cat].checked ? resource.data!.categories[cat].results.some(r => r.groupId === id) ? 'Acertada' : 'No entró' : 'Por comprobar'}</span></li>)}</ul></div>)}</div></section>}
  </>;
}
