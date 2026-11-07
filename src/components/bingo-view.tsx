'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { useApp } from './app-provider';
import { useCompetitionResource } from '@/hooks/use-competition';
import { CompetitionIntro, ModuleGate, ResourceMessage } from './competition-ui';
import type { BingoCard, BingoData } from '@/lib/competition';
import { shareBingo } from '@/lib/share-image';
interface BingoRanking { ranking: { handle: string; points: number; lines: number; marks: number; bingo: boolean; position: number }[]; practice: boolean }
export function BingoView({ practiceOnly = false }: { practiceOnly?: boolean }) { return <ModuleGate module="bingo"><BingoContent practiceOnly={practiceOnly} /></ModuleGate>; }
function BingoContent({ practiceOnly }: { practiceOnly: boolean }) {
  const { state, mutate, openAuth } = useApp();
  const [session, setSession] = useState('libre');
  const resource = useCompetitionResource<BingoData>(`/api/competition/bingo?session=${encodeURIComponent(session)}`);
  const ranking = useCompetitionResource<BingoRanking>(`/api/competition/bingo/ranking?session=${encodeURIComponent(session)}`);
  const [card, setCard] = useState<BingoCard | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [exporting, setExporting] = useState(false);
  const [texts, setTexts] = useState<string[]>(Array(10).fill('')), [editing, setEditing] = useState(false);
  const draftKey = `votacoac-2027-bingo-draft-${session}`;
  useEffect(() => { setCard(null); setEditing(false); }, [session, state.user?.id]);
  useEffect(() => { if (!busy && resource.data?.sessionId === session) setCard(current => current && resource.data!.readAt < current.updatedAt ? current : resource.data!.card); }, [resource.data, busy, session]);
  useEffect(() => { try { const draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); setTexts(Array.isArray(draft) && draft.length === 10 ? draft.map(t => String(t).slice(0, 130)) : Array(10).fill('')); } catch { setTexts(Array(10).fill('')); } }, [draftKey]);
  const changeText = (index: number, value: string) => { setTexts(current => { const next = current.map((text, i) => i === index ? value : text); try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* El borrador sigue disponible mientras la página esté abierta. */ } return next; }); };
  const save = async () => {
    if (!state.user) { openAuth('register'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await mutate<{ card: BingoCard }>('/api/competition/bingo', card ? 'PATCH' : 'POST', { sessionId: session, cells: texts, ...(card ? { cardId: card.id, expectedUpdatedAt: card.updatedAt } : {}) });
      setCard(result.card); setEditing(false); try { localStorage.removeItem(draftKey); } catch { /* El cartón ya está guardado en la cuenta. */ } resource.reload();
    } catch (error) { setMessage((error as Error).message); resource.reload(); } finally { setBusy(false); }
  };
  const mark = async (index: number) => {
    if (!card || busy) return; setBusy(true); setMessage('');
    const marked = card.marked.includes(index) ? card.marked.filter(value => value !== index) : [...card.marked, index];
    try { const result = await mutate<{ card: BingoCard }>('/api/competition/bingo', 'PUT', { cardId: card.id, marked, expectedUpdatedAt: card.updatedAt }); setCard(result.card); resource.reload(); ranking.reload(); }
    catch (error) { setMessage((error as Error).message); resource.reload(); } finally { setBusy(false); }
  };
  const sessionInfo = state.catalog.sessions.find(s => s.id === session), sessionName = sessionInfo?.name || 'Cartón personal · modo libre';
  const serial = card ? card.id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() : '';
  const open = !!resource.data?.window.open, ready = texts.every(text => text.trim().length >= 3);
  const ideas = state.competition?.config.bingo.situations || [];
  return <>
    <CompetitionIntro title="Tu bingo del Falla" label="Diez casillas. Tu propio cartón." text="Escribe las diez cosas que crees que van a pasar, márcalas cuando ocurran y espera la validación de administración. Por ejemplo: «Cuplé a Andy y Lucas»." color="yellow" />
    <div className="bingo-toolbar"><label>Función<select value={session} disabled={busy} onChange={e => { setSession(e.target.value); setMessage(''); }}><option value="libre">Mi cartón libre</option>{!practiceOnly && state.catalog.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{card && <button className="action-button action-white" disabled={exporting} onClick={async () => { setExporting(true); try { await shareBingo(card, sessionName, { edition: state.catalog.edition.name, serial }); } catch (error) { setMessage((error as Error).message); } finally { setExporting(false); } }}><Download size={16} />{exporting ? 'Generando…' : 'Compartir cartón'}</button>}</div>
    <ResourceMessage {...resource} />
    {message && <p className="service-notice" role="status">{message}</p>}
    {resource.data && !open && <p className="service-notice">{resource.data.window.reason}</p>}
    {(!card || editing) && !resource.loading && !resource.error && <section className="bingo-custom-editor" aria-labelledby="bingo-editor-title"><header><span className="mini-label">Hecho por ti</span><h2 id="bingo-editor-title">¿Qué va a pasar <span className="serif">esta noche?</span></h2><p>Escribe diez situaciones distintas. Podrás editarlas hasta que marques una casilla o administración revise el cartón.</p></header><div className="bingo-custom-fields">{texts.map((text, index) => <label key={index}><span>{String(index + 1).padStart(2, '0')}</span><span className="sr-only">Casilla {index + 1}</span><textarea value={text} maxLength={130} rows={3} onChange={e => changeText(index, e.target.value)} placeholder={index === 0 ? 'Cuplé a Andy y Lucas…' : ideas[index]?.text || 'Una situación del Carnaval…'} disabled={busy} /></label>)}</div><div className="bingo-editor-actions"><button className="action-button action-blue" disabled={busy || !open || !ready} onClick={() => { void save(); }}>{busy ? 'Guardando…' : state.user ? 'Guardar mis diez casillas' : 'Registrarme y guardar cartón'}</button><button className="text-link" disabled={busy || !open || ideas.length < 10} onClick={() => { const next = ideas.slice(0, 10).map(s => s.text); setTexts(next); try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* Borrador en memoria. */ } }}>Usar diez ideas de ejemplo</button>{editing && <button className="text-link" disabled={busy} onClick={() => setEditing(false)}>Cancelar edición</button>}</div><p className="small-note">Tus textos se guardan en tu cuenta. Cada casilla se valida individualmente; marcarla no la confirma.</p></section>}
    {card && !editing && <motion.article className="bingo-ticket" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} aria-label={`Cartón personal de ${card.cells.length} casillas`}>
      <header className="ticket-head"><div className="ticket-brand"><span>votaCOAC · {state.catalog.edition.name}</span><h2>Bingo del Falla</h2><p>{card.cells.length} situaciones escritas por ti</p></div><dl className="ticket-meta"><div><dt>Función</dt><dd>{sessionName}</dd></div><div><dt>Cartón nº</dt><dd className="ticket-serial">{serial}</dd></div></dl></header>
      <div className="ticket-letters" aria-hidden="true">{'BINGO'.split('').map(letter => <span key={letter}>{letter}</span>)}</div>
      <div className={`bingo-board ${card.cells.length === 10 ? 'is-ten' : ''}`} role="group" aria-label={`${card.cells.length} casillas personalizadas`}>{card.cells.map((cell, index) => {
        const marked = card.marked.includes(index), review = card.reviews[cell.id], verified = card.verified.marked.includes(index);
        const status = review?.status === 'approved' ? 'Validada' : review?.status === 'rejected' ? 'No validada' : marked ? 'Pendiente de validar' : 'Sin marcar';
        return <button className={`bingo-cell ${marked ? 'is-marked' : ''} ${verified ? 'is-verified' : ''}`} key={cell.id} aria-pressed={marked} aria-label={`Casilla ${index + 1}: ${cell.text}. ${status}`} title={review?.reason} disabled={busy || !open} onClick={() => { void mark(index); }}><span className="bingo-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="bingo-text">{cell.text}</span><AnimatePresence>{marked && <motion.i className="bingo-chip" aria-hidden="true" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} />}</AnimatePresence><small className="bingo-review-state" data-status={review?.status || (marked ? 'pending' : 'empty')}>{status}</small></button>;
      })}</div>
      <footer className="ticket-foot"><span><strong>{card.marked.length}</strong>/{card.cells.length} marcadas</span><span><strong>{card.verified.marked.length}</strong> validadas y marcadas</span><AnimatePresence>{card.verified.bingo && <motion.strong className="bingo-celebration" role="status" initial={{ scale: 0.7 }} animate={{ scale: 1 }}>¡BINGO VALIDADO!</motion.strong>}</AnimatePresence><small aria-live="polite">{busy ? 'Guardando…' : 'Cartón guardado'}</small></footer>
      {card.editable ? <button className="text-link bingo-edit-link" disabled={busy || !open} onClick={() => { setTexts(card.cells.length === 10 ? card.cells.map(c => c.text) : card.cells.slice(0, 10).map(c => c.text)); setEditing(true); }}>Editar mis diez casillas</button> : <p className="small-note bingo-edit-link">El texto del cartón ya está cerrado. Puedes seguir marcando y desmarcando.</p>}
      {card.cells.length !== 10 && <p className="small-note bingo-edit-link">Este cartón se creó con el formato anterior y conserva sus casillas y progreso.</p>}
    </motion.article>}
    {resource.data?.practice && <p className="play-notice">Tu cartón libre también puede recibir validación. No entra en la clasificación de las funciones. {practiceOnly ? 'Los cartones por función estarán disponibles durante el concurso.' : 'Elige una función cuando se publique el calendario.'}</p>}
    {resource.data?.competitive && <section className="chart-panel"><div className="panel-heading"><h2>Clasificación de esta función</h2></div><p className="small-note mt-3">Solo puntúan las casillas que hayas marcado y administración haya validado: 1 punto por casilla, 5 por una fila completa de cinco y 50 por el bingo. Una corrección de administración actualiza la clasificación.</p><ResourceMessage {...ranking} />{ranking.data?.ranking.length ? <div className="table-scroll league-table mt-5"><table><thead><tr><th>Puesto</th><th>Alias</th><th>Puntos</th><th>Validadas</th><th>Bingo</th></tr></thead><tbody>{ranking.data.ranking.map(row => <tr key={row.handle}><td>{row.position}</td><td>{row.handle}</td><td>{row.points}</td><td>{row.marks}</td><td>{row.bingo ? 'Sí' : '—'}</td></tr>)}</tbody></table></div> : <p className="chart-empty">Todavía no hay casillas marcadas y validadas en esta función.</p>}</section>}
  </>;
}
