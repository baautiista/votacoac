'use client';
import { useState } from 'react';
import type { Performance } from '@/lib/types';
import { TrafficBadge } from './competition-ui';
import { VotingDialog } from './voting-dialog';
import { useApp } from './app-provider';
export function GroupCard({ performance, index = 0, aguja = false }: { performance: Performance; index?: number; aguja?: boolean }) {
  const { state, openAuth, saveVote, favorite } = useApp(); const { group } = performance;
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [savingFavorite, setSavingFavorite] = useState(false); const [needleScore, setNeedleScore] = useState(7);
  const saved = state.personal.favorites.includes(group.id);
  const voted = state.personal.votes.filter(v => v.performanceId === (aguja ? `aguja_${group.id}` : performance.id));
  const votedTypes = voted.map(v => v.votingType === 'Avanzado' ? 'avanzado' : v.votingType === 'Apto/No Apto' ? 'apto/no apto' : 'aguja');
  const completed = aguja ? votedTypes.includes('aguja') : votedTypes.includes('avanzado') && votedTypes.includes('apto/no apto');
  const enabled = state.catalog.edition.votingOpen && Date.now() >= Date.parse(performance.actTime);
  const send = async (type: string, score: number, details?: unknown) => {
    setBusy(true); try { if (await saveVote(aguja ? `aguja_${group.id}` : performance.id, aguja ? 'aguja' : type === 'avanzado' ? 'advanced' : 'apto', score, details)) setOpen(false); } finally { setBusy(false); }
  };
  return <>
    <article className="group-card" data-category={group.category} data-tone={index % 5} aria-label={group.name}>
      <div className="card-topline"><span className="group-category">{group.category}</span><span className="card-edition">{group.needsReview ? 'Nombre por revisar' : state.catalog.edition.demo ? 'Ejemplo' : state.catalog.edition.name}</span></div>
      <div className="group-content"><h3>{state.competition?.config.modules.evolution !== false ? <a href={`?grupo=${encodeURIComponent(group.id)}#evolucion`} onClick={e => { e.preventDefault(); window.history.pushState(null, '', `?grupo=${encodeURIComponent(group.id)}#evolucion`); window.dispatchEvent(new Event('hashchange')); window.scrollTo({top:0,behavior:'instant'}); }} aria-label={`Ver ficha y evolución de ${group.name}`}>{group.name}</a> : group.name}</h3><p className="group-author">{group.author || group.locality || 'Autoría sin documentar'}</p><p className="group-description">{group.description}</p></div>
      <div className="card-bottom">{state.competition?.config.modules.traffic && performance.scheduled !== false && !aguja && <TrafficBadge compact traffic={state.competition.traffic[performance.id]} />}<p className="card-status">{completed ? 'Ya has votado. ¡Gracias!' : performance.scheduled === false ? 'Actuación pendiente de programar' : !enabled ? 'Votación cerrada' : votedTypes.length ? 'Te queda otra forma de votar' : aguja ? 'Puntúa el tipo del 1 al 10' : 'Apto / No apto o por puntuación'}</p>
        <div className="card-actions"><button className="group-vote-button" disabled={completed || !enabled || busy} onClick={() => state.user ? setOpen(true) : openAuth('login')}>{completed ? 'Votado' : 'Votar'}</button><button className={`favorite-button ${saved ? 'is-saved' : ''}`} aria-pressed={saved} aria-label={`${saved ? 'Quitar de favoritas' : 'Guardar'} ${group.name}`} disabled={savingFavorite} onClick={async () => { setSavingFavorite(true); try { await favorite(group.id); } finally { setSavingFavorite(false); } }}>{savingFavorite ? 'Guardando…' : saved ? 'Guardada' : 'Guardar'}</button></div>
      </div>
    </article>
    {aguja && open ? <NeedleDialog name={group.name} score={needleScore} setScore={setNeedleScore} busy={busy} close={() => setOpen(false)} send={() => { void send('aguja', needleScore); }} /> : <VotingDialog isOpen={open} onClose={() => setOpen(false)} group={group} onVoteSuccess={send} votedTypes={votedTypes} isSaving={busy} submissionAvailable={enabled} />}
  </>;
}
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
function NeedleDialog({ name, score, setScore, busy, close, send }: { name: string; score: number; setScore: (score: number) => void; busy: boolean; close: () => void; send: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent><span className="mini-label">Aguja de Oro</span><DialogTitle className="auth-title">{name}</DialogTitle><DialogDescription>Valora el diseño y la puesta en escena del tipo. Un voto por agrupación.</DialogDescription><div className="needle-score">{score}<small>/10</small></div><label className="sr-only" htmlFor="needle-score">Puntuación del tipo</label><input id="needle-score" type="range" min="1" max="10" value={score} onChange={e => setScore(Number(e.target.value))} /><div className="flex justify-between text-xs text-muted-foreground"><span>1 · Puede mejorar</span><span>10 · Espectacular</span></div><button className="action-button action-blue" onClick={send} disabled={busy}>{busy ? 'Guardando…' : 'Guardar mi voto'}</button></DialogContent></Dialog>;
}
