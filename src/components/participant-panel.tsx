'use client';
import { motion } from 'framer-motion';
import { ArrowRight, AtSign, Check, Grid3x3, Heart, Medal, Star, Trophy, Users, Vote, type LucideIcon } from 'lucide-react';
import { useApp } from './app-provider';
import { CountUp, fadeUp, stagger } from './motion';
import { formatDate } from './competition-ui';
import { useCompetitionResource } from '@/hooks/use-competition';
import { forecastPhases, phaseLabels } from '@/lib/competition';
import { categoryOrder } from '@/lib/design';
import { stageOf } from '@/lib/stage';
import type { ActiveView } from '@/lib/types';

interface Mission { id: string; icon: LucideIcon; title: string; text: string; current: number; target: number; view?: ActiveView; action: string }
interface Activity { key: string; at: number; label: string; title: string; detail?: string }

/** Tramos del Falla según las misiones completadas. Solo describen progreso: no son puntos. */
const levels = ['Taquilla', 'Patio de butacas', 'Palco', 'Paraíso', 'Escenario'];

/** Misiones calculadas con datos guardados en la cuenta. No suman puntos: la Liga mantiene sus reglas. */
function useMissions(onAlias: () => void) {
  const { state } = useApp(); const competition = state.competition; const modules = competition?.config.modules; const stage = stageOf(competition?.config);
  const leagues = useCompetitionResource<{ leagues: { id: string }[] }>(state.user && modules?.league ? '/api/competition/leagues' : null);
  const bingo = useCompetitionResource<{ card: unknown | null }>(state.user && modules?.bingo ? '/api/competition/bingo?session=libre' : null);
  const personal = competition?.personal;
  const missions: (Mission & { onAction?: () => void })[] = [];
  if (competition) missions.push({ id: 'alias', icon: AtSign, title: 'Elige tu alias', text: 'Es tu nombre en la Liga y en las clasificaciones.', current: personal?.handle ? 1 : 0, target: 1, action: 'Elegir alias', onAction: onAlias });
  missions.push({ id: 'guardadas', icon: Heart, title: 'Guarda tres agrupaciones', text: 'Tenlas a mano para seguirlas durante el concurso.', current: state.personal.favorites.length, target: 3, view: 'funciones', action: 'Explorar agrupaciones' });
  if (modules?.support) missions.push({ id: 'favoritas', icon: Star, title: 'Elige tus favoritas', text: 'Una por modalidad en los Favoritos del público.', current: Object.keys(personal?.support || {}).length, target: categoryOrder.length, view: 'termometro', action: 'Elegir favoritas' });
  if (modules?.predictions) missions.push({ id: 'quiniela', icon: Trophy, title: 'Prepara una quiniela', text: 'Guarda tu pronóstico de cualquier fase dentro de su plazo.', current: Math.min(1, Object.keys(personal?.forecasts || {}).length), target: 1, view: 'pronosticos', action: 'Preparar quiniela' });
  if (modules?.league) missions.push({ id: 'liga', icon: Users, title: 'Únete a una liga', text: 'Crea una liga privada o entra con un código de invitación.', current: Math.min(1, leagues.data?.leagues.length || 0), target: 1, view: 'liga', action: 'Ir a ligas' });
  if (modules?.bingo) missions.push({ id: 'bingo', icon: Grid3x3, title: 'Entrena con el bingo libre', text: 'Saca tu cartón de práctica. No puntúa.', current: bingo.data?.card ? 1 : 0, target: 1, view: 'bingo', action: 'Sacar cartón' });
  if (stage === 'durante') missions.push({ id: 'voto', icon: Vote, title: 'Vota una actuación', text: 'Tu voto se suma a la valoración popular.', current: Math.min(1, state.personal.votes.length), target: 1, view: 'funciones', action: 'Votar' });
  return { missions, loading: leagues.loading || bingo.loading };
}

export function ParticipantPanel({ onNavigate, onAlias }: { onNavigate: (view: ActiveView) => void; onAlias: () => void }) {
  const { state } = useApp(); const personal = state.competition?.personal; const { missions, loading } = useMissions(onAlias);
  const done = missions.filter(m => m.current >= m.target).length; const ratio = missions.length ? done / missions.length : 0;
  const level = levels[Math.min(levels.length - 1, Math.floor(ratio * (levels.length - 1)))];
  const next = missions.find(m => m.current < m.target);
  const activity: Activity[] = [
    ...state.personal.votes.filter(v => v.createdAt).map((v, i) => ({ key: `v${v.id || i}`, at: v.createdAt!, label: v.votingType, title: v.groupName, detail: v.votingType === 'Apto/No Apto' ? v.apto ? 'Apto' : 'No apto' : v.score?.toLocaleString('es', { maximumFractionDigits: 2 }) })),
    ...forecastPhases.flatMap(phase => { const f = personal?.forecasts[phase]; return f ? [{ key: `f${phase}`, at: f.updatedAt, label: 'Quiniela', title: `Pronóstico de ${phaseLabels[phase]}`, detail: `${Object.values(f.selection).flat().length} elegidas` }] : []; }),
  ].sort((a, b) => b.at - a.at).slice(0, 6);
  return <div className="participant-panel">
    <section className="scoreboard" aria-label="Marcador del participante">
      <div className="scoreboard-cell is-main"><span>Puntos de la Liga</span><strong>{personal ? <CountUp value={personal.points} /> : '—'}</strong><small>Con las reglas oficiales de puntuación</small></div>
      <div className="scoreboard-cell"><span>Posición</span><strong>{personal?.position ? `${personal.position}º` : '—'}</strong></div>
      <div className="scoreboard-cell"><span>Aciertos</span><strong>{personal ? <CountUp value={personal.hits} /> : '—'}</strong></div>
      <div className="scoreboard-cell"><span>Exactos</span><strong>{personal ? <CountUp value={personal.exactHits} /> : '—'}</strong></div>
      <div className="scoreboard-cell"><span>Insignias</span><strong>{personal ? <CountUp value={personal.badges.length} /> : '—'}</strong></div>
    </section>

    <section className="mission-board" aria-labelledby="missions-title">
      <header className="mission-head">
        <div><span className="mini-label">Tu temporada</span><h2 id="missions-title">Misiones</h2><p>Se completan solas con lo que guardas en tu cuenta. No suman puntos.</p></div>
        <div className="season-progress" aria-label={`${done} de ${missions.length} misiones completadas`}>
          <span className="season-level"><small>Tu localidad</small><strong>{level}</strong></span>
          <span className="season-track" aria-hidden="true"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.round(ratio * 100)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} /></span>
          <small>{done}/{missions.length} completadas{loading ? ' · comprobando…' : ''}</small>
        </div>
      </header>
      <motion.ol className="mission-list" initial="hidden" animate="show" variants={stagger(0.05)}>
        {missions.map(m => { const complete = m.current >= m.target; const Icon = m.icon; return <motion.li variants={fadeUp} key={m.id} className={`mission ${complete ? 'is-done' : ''} ${next?.id === m.id ? 'is-next' : ''}`}>
          <span className="mission-icon" aria-hidden="true">{complete ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}</span>
          <div className="mission-copy"><strong>{m.title}</strong><span>{m.text}</span>
            {m.target > 1 && <span className="mission-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, m.current / m.target * 100)}%` }} /></span>}
          </div>
          <span className="mission-count">{Math.min(m.current, m.target)}/{m.target}</span>
          {complete ? <span className="mission-done">Completada</span> : <button type="button" className="mission-go" onClick={() => m.onAction ? m.onAction() : m.view && onNavigate(m.view)}>{m.action}<ArrowRight size={14} /></button>}
        </motion.li>; })}
      </motion.ol>
    </section>

    <div className="panel-columns">
      <section className="settings-panel badge-shelf" aria-labelledby="badges-title"><h2 id="badges-title"><Medal size={20} aria-hidden="true" /> Insignias</h2>{personal?.badges.length ? <div className="badge-grid">{personal.badges.map(b => <div className="achievement-badge" key={b.id}><span className="badge-icon" aria-hidden="true"><Medal size={22} /></span><strong>{b.name}</strong><span>Conseguida con tu participación real.</span></div>)}</div> : <p className="chart-empty">Tus insignias aparecerán cuando participes y aciertes en la Liga.</p>}</section>
      <section className="settings-panel activity-feed" aria-labelledby="activity-title"><h2 id="activity-title">Actividad reciente</h2>{activity.length ? <ol>{activity.map(a => <li key={a.key}><span className="activity-dot" aria-hidden="true" /><div><small>{a.label} · {formatDate(a.at)}</small><strong>{a.title}</strong></div>{a.detail && <b>{a.detail}</b>}</li>)}</ol> : <p className="chart-empty">Aún no hay actividad. Empieza por la primera misión.</p>}</section>
    </div>
  </div>;
}
