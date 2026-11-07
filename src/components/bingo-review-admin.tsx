'use client';
import { useEffect, useState } from 'react';
import { useApp } from './app-provider';
import { useCompetitionResource } from '@/hooks/use-competition';
import { ResourceMessage } from './competition-ui';
import type { BingoCard } from '@/lib/competition';
type ReviewCard = BingoCard & { handle: string };
interface ReviewData { cards: ReviewCard[]; nextOffset: number | null }
export function BingoReviewAdmin() {
  const { state, mutate } = useApp();
  const [session, setSession] = useState(''), [offset, setOffset] = useState(0), [reason, setReason] = useState(''), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const resource = useCompetitionResource<ReviewData>(`/api/admin/bingo-cards?session=${encodeURIComponent(session)}&offset=${offset}`);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  useEffect(() => { if (resource.data && !busy) setCards(previous => resource.data!.cards.map(card => { const newer = previous.find(c => c.id === card.id); return newer && newer.updatedAt > card.updatedAt ? newer : card; })); }, [resource.data, busy]);
  const saveReview = async (card: ReviewCard, cellId: string, status: 'approved' | 'rejected' | 'pending') => {
    const cell = card.cells.find(c => c.id === cellId); if (!cell) return;
    setBusy(cellId); setMessage('');
    try {
      const result = await mutate<{ card: BingoCard }>('/api/admin/bingo-cards', 'PUT', { cardId: card.id, cellId, status, expectedText: cell.text, expectedUpdatedAt: card.updatedAt, reason });
      setCards(current => current.map(value => value.id === card.id ? { ...result.card, handle: card.handle } : value));
      setMessage('Casilla revisada. La validación y su motivo han quedado registrados.'); resource.reload();
    } catch (error) { setMessage((error as Error).message); resource.reload(); } finally { setBusy(''); }
  };
  return <section className="settings-panel bingo-review-admin" aria-labelledby="bingo-review-title">
    <div className="section-heading"><div><span className="mini-label">Cartones de los participantes</span><h2 id="bingo-review-title">Validar casilla por casilla</h2><p>Revisa el texto exacto de cada usuario. Una marca personal solo cuenta cuando tú confirmas que ocurrió.</p></div><button className="action-button action-white" onClick={resource.reload} disabled={!!busy}>Actualizar cartones</button></div>
    <div className="account-grid"><label>Función<select value={session} onChange={e => { setSession(e.target.value); setOffset(0); }} disabled={!!busy}><option value="">Todos los cartones</option><option value="libre">Cartones libres</option>{state.catalog.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Motivo o referencia de la revisión<input value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={240} placeholder="He comprobado esta situación en…" /></label></div>
    <ResourceMessage {...resource} />{message && <p className="service-notice" role="status">{message}</p>}
    <div className="bingo-review-cards">{cards.map((card, cardIndex) => <details className="bingo-review-card" key={card.id} open={cardIndex < 2}><summary><strong>@{card.handle}</strong><span>{card.sessionId === 'libre' ? 'Cartón libre' : state.catalog.sessions.find(s => s.id === card.sessionId)?.name || card.sessionId}</span><span>{card.cells.filter(c => card.reviews[c.id]?.status === 'approved').length}/{card.cells.length} validadas · {card.marked.length} marcadas</span></summary><ol>{card.cells.map((cell, index) => {
      const review = card.reviews[cell.id], status = review?.status || 'pending', disabled = !!busy || reason.trim().length < 5;
      return <li key={cell.id} data-status={status}><div className="review-cell-copy"><span>{String(index + 1).padStart(2, '0')} · {card.marked.includes(index) ? 'Marcada por el usuario' : 'Sin marcar'}</span><strong>{cell.text}</strong><small>{status === 'approved' ? 'Validada' : status === 'rejected' ? 'No validada' : 'Pendiente de revisión'}{review?.reason ? ` · ${review.reason}` : ''}</small></div>{card.cells.length === 10 ? <div className="review-cell-actions"><button className="review-approve" disabled={disabled || status === 'approved'} onClick={() => { void saveReview(card, cell.id, 'approved'); }}>Validar</button><button className="review-reject" disabled={disabled || status === 'rejected'} onClick={() => { void saveReview(card, cell.id, 'rejected'); }}>No ocurrió</button>{status !== 'pending' && <button className="text-link" disabled={disabled} onClick={() => { void saveReview(card, cell.id, 'pending'); }}>Dejar pendiente</button>}</div> : <small>Cartón del formato anterior</small>}</li>;
    })}</ol></details>)}</div>
    {!cards.length && !resource.loading && <p className="chart-empty">Aún no hay cartones en esta selección. Los usuarios pueden crear sus diez casillas desde Bingo.</p>}
    <div className="bingo-editor-actions"><button className="action-button action-white" disabled={offset === 0 || !!busy} onClick={() => setOffset(value => Math.max(0, value - 25))}>Anterior</button><button className="action-button action-white" disabled={resource.data?.nextOffset == null || !!busy} onClick={() => setOffset(resource.data?.nextOffset || 0)}>Siguiente</button></div>
  </section>;
}
