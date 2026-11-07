'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Lock, Settings, Sparkles } from 'lucide-react';
import { useApp } from './app-provider';
import { TopFiveSummary } from './top-five-view';
import { formatDate } from './competition-ui';
import { ease, fadeUp, stagger } from './motion';
import { beforeFeatures, duringFeatures, stageOf, type StageArea, type StageFeature } from '@/lib/stage';
import { forecastPhases, phaseLabels } from '@/lib/competition';
import { categoryOrder } from '@/lib/design';
import type { ActiveView } from '@/lib/types';

/** Selector visible entre las dos áreas del concurso. */
export function StageSwitch({ area, onChange, className = '' }: { area: StageArea; onChange: (area: StageArea) => void; className?: string }) {
  const { state } = useApp(); const stage = stageOf(state.competition?.config);
  const options: { id: StageArea; num: string; label: string; note: string; live: boolean }[] = [
    { id: 'antes', num: '01', label: 'Antes del concurso', note: 'Disponible ahora', live: true },
    { id: 'durante', num: '02', label: 'Durante el concurso', note: stage === 'durante' ? 'En marcha' : 'Las cinco del público', live: true },
  ];
  return <div className={`stage-switch ${className}`} role="group" aria-label="Etapas del concurso">
    {options.map(o => <button key={o.id} type="button" className={`stage-switch-option ${area === o.id ? 'is-active' : ''}`} data-area={o.id} aria-pressed={area === o.id} onClick={() => onChange(o.id)}>
      {area === o.id && <motion.span layoutId="stage-switch-pill" className="stage-switch-pill" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
      <em aria-hidden="true">{o.num}</em>
      <span className="stage-switch-copy"><strong>{o.label}</strong><small data-live={o.live}>{o.live ? <i className="live-dot" aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}{o.note}</small></span>
    </button>)}
  </div>;
}

/** Estado real de cada entrada, calculado con la configuración y los datos guardados. */
function useFeatureStatus() {
  const { state } = useApp(); const competition = state.competition;
  return (feature: StageFeature): string => {
    if (!competition) return '';
    switch (feature.id) {
      case 'favoritos': { const chosen = Object.keys(competition.personal.support).length; const closes = competition.config.support.closesAt; return competition.config.support.open ? `${chosen}/${categoryOrder.length} elegidas${closes ? ` · cierra ${formatDate(closes)}` : ''}` : 'Votación de favoritas cerrada'; }
      case 'quiniela': { return competition.personal.forecasts.top5 ? 'Tu quiniela está guardada' : competition.windows.top5?.open ? 'Elige cinco por modalidad' : 'Elección cerrada'; }
      case 'ligas': return competition.personal.handle ? `Juegas como @${competition.personal.handle}` : 'Elige un alias para competir';
      case 'agrupaciones': return `${state.catalog.groups.length} en el cartel`;
      case 'bingo-libre': return 'Entrenamiento · sin puntuación';
      default: return 'En directo';
    }
  };
}

function EntryTicket({ feature, index, status, onNavigate }: { feature: StageFeature; index: number; status: string; onNavigate: (view: ActiveView) => void }) {
  return <motion.button type="button" variants={fadeUp} whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} className={`entry-ticket tone-${feature.tone}`} onClick={() => onNavigate(feature.view)}>
    <span className="entry-stub" aria-hidden="true"><em>Nº</em><b>{String(index + 1).padStart(2, '0')}</b></span>
    <span className="entry-body">
      <span className="entry-kicker">{feature.kicker}</span>
      <strong>{feature.title}</strong>
      <span className="entry-text">{feature.text}</span>
      {status && <span className="entry-status">{status}</span>}
    </span>
    <span className="entry-go" aria-hidden="true"><ArrowRight size={18} /></span>
  </motion.button>;
}

function LockedCard({ feature, index }: { feature: StageFeature; index: number }) {
  return <motion.li variants={fadeUp} className={`locked-card tone-${feature.tone}`} aria-label={`${feature.kicker}: próximamente, bloqueado hasta que empiece el concurso`}>
    <span className="locked-seal" aria-hidden="true"><Lock size={16} /></span>
    <span className="locked-num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <span className="entry-kicker">{feature.kicker}</span>
    <strong>{feature.title}</strong>
    <p>{feature.text}</p>
    {feature.promise && <ul>{feature.promise.map(item => <li key={item}>{item}</li>)}</ul>}
    <span className="locked-state">Bloqueado · Próximamente</span>
  </motion.li>;
}

/** Cartel luminoso «Próximamente». */
export function ComingSoonSign({ small = false }: { small?: boolean }) {
  return <div className={`marquee-sign ${small ? 'is-small' : ''}`} aria-hidden="true"><span className="marquee-bulbs" /><strong>Próximamente</strong><span className="marquee-bulbs" /></div>;
}

/** Las dos áreas: la previa disponible y el concurso, que se presenta bloqueado hasta su activación. */
export function StageAreaPanel({ area, onNavigate }: { area: StageArea; onNavigate: (view: ActiveView) => void }) {
  const { state } = useApp(); const competition = state.competition; const stage = stageOf(competition?.config); const status = useFeatureStatus();
  const enabled = (f: StageFeature) => !f.module || competition?.config.modules[f.module] !== false;
  const before = beforeFeatures.filter(enabled); const during = duringFeatures.filter(enabled);
  return <AnimatePresence mode="wait" initial={false}>
    {area === 'antes' ? <motion.section key="antes" className="stage-area area-before" aria-labelledby="area-before-title" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }} transition={{ duration: 0.45, ease }}>
      <header className="stage-area-head"><span className="mini-label">Área 1 · Disponible ahora</span><h2 id="area-before-title">La previa ya está <span className="serif">en escena.</span></h2><p>Todo lo que puedes hacer antes de que se levante el telón del concurso.</p></header>
      <motion.div className="entry-grid" initial="hidden" animate="show" variants={stagger(0.06, 0.05)}>{before.map((f, i) => <EntryTicket key={f.id} feature={f} index={i} status={status(f)} onNavigate={onNavigate} />)}</motion.div>
    </motion.section>
    : <motion.section key="durante" className={`stage-area area-during ${stage === 'antes' ? 'is-locked' : 'is-live'}`} aria-labelledby="area-during-title" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16, transition: { duration: 0.18 } }} transition={{ duration: 0.45, ease }}>
      <TopFiveSummary onNavigate={onNavigate} />
      {stage === 'antes' ? <>
        <header className="stage-area-head"><ComingSoonSign /><span className="mini-label">Área 2 · Durante el concurso</span><h2 id="area-during-title">Esto llegará cuando <span className="serif">suba el telón.</span></h2><p>Se activará cuando empiece el concurso. Mientras tanto, prepara tu previa.</p></header>
        <motion.ul className="locked-grid" initial="hidden" animate="show" variants={stagger(0.07, 0.1)}>{during.map((f, i) => <LockedCard key={f.id} feature={f} index={i} />)}</motion.ul>
        <div className="stage-area-foot"><button type="button" className="action-button action-white" onClick={() => onNavigate('previa')}>Ir a la previa <ArrowRight size={16} /></button>{state.user?.role === 'admin' && <button type="button" className="action-button action-blue" onClick={() => onNavigate('admin')}><Settings size={16} /> Activar desde administración</button>}</div>
      </> : <>
        <header className="stage-area-head"><span className="onair-sign"><i className="live-dot" aria-hidden="true" /> En directo</span><span className="mini-label">Área 2 · Durante el concurso</span><h2 id="area-during-title">El telón está <span className="serif">arriba.</span></h2><p>Vota las actuaciones y sigue el concurso función a función.</p></header>
        <motion.div className="entry-grid" initial="hidden" animate="show" variants={stagger(0.06, 0.05)}>{during.map((f, i) => <EntryTicket key={f.id} feature={f} index={i} status={status(f)} onNavigate={onNavigate} />)}</motion.div>
      </>}
    </motion.section>}
  </AnimatePresence>;
}

/** Página de cada área, con el selector visible arriba. */
export function StageHub({ area, onNavigate }: { area: StageArea; onNavigate: (view: ActiveView) => void }) {
  return <>
    <section className={`stage-hero hero-${area}`}>
      <span className="proscenium-arch" aria-hidden="true" />
      <span className="curtain curtain-left" aria-hidden="true" /><span className="curtain curtain-right" aria-hidden="true" />
      <div className="stage-hero-copy"><span className="mini-label">Gran Teatro Falla · COAC 2027</span><h1>{area === 'antes' ? <>La previa</> : <>El concurso</>}</h1><p>{area === 'antes' ? 'Las cinco del público, ligas y tu bingo personal: empieza antes del primer pase.' : 'Las cinco que llegarán más lejos en cada modalidad. Regístrate para comprobar tus aciertos al terminar.'}</p></div>
    </section>
    <StageSwitch area={area} onChange={next => onNavigate(next === 'antes' ? 'previa' : 'concurso')} className="is-hub" />
    <StageAreaPanel area={area} onNavigate={onNavigate} />
  </>;
}

/** Pantalla bloqueada cuando se entra en una sección del concurso antes de activarlo. */
export function ComingSoonView({ view, onNavigate }: { view: ActiveView; onNavigate: (view: ActiveView) => void }) {
  const feature = duringFeatures.find(f => f.view === view) || (view === 'aguja' ? duringFeatures[0] : view === 'semaforo' ? duringFeatures[1] : duringFeatures[2]);
  return <section className="coming-soon" aria-labelledby="coming-title">
    <div className="coming-stage">
      <span className="proscenium-arch" aria-hidden="true" />
      <motion.span className="curtain curtain-left is-closed" aria-hidden="true" initial={{ scaleX: 0.6 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease }} />
      <motion.span className="curtain curtain-right is-closed" aria-hidden="true" initial={{ scaleX: 0.6 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease }} />
      <div className="coming-copy"><ComingSoonSign small /><span className="mini-label">Durante el concurso · {feature.kicker}</span><h1 id="coming-title">{feature.title}</h1><p>{feature.text}</p>{feature.promise && <ul className="coming-promise">{feature.promise.map(p => <li key={p}><Lock size={13} aria-hidden="true" />{p}</li>)}</ul>}<p className="coming-note">Esta sección está bloqueada hasta que empiece el concurso.</p></div>
    </div>
    <div className="coming-actions"><button type="button" className="action-button action-blue" onClick={() => onNavigate('previa')}><Sparkles size={16} /> Ir a la previa</button><button type="button" className="action-button action-white" onClick={() => onNavigate('concurso')}>Ver lo que llegará</button></div>
  </section>;
}
