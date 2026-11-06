import type { CompetitionState } from './competition';
import type { Group, GroupCategory, PersonalVote, RankingEntry } from './types';
export type VoteType = 'advanced' | 'apto' | 'aguja';
export type Prediction = Record<GroupCategory, string[]>;
export interface Catalog {
  edition: { id: string; name: string; demo: boolean; notice: string; votingOpen: boolean };
  groups: Group[];
  sessions: { phase?: string; id: string; name: string; location: string; date: string; time: string; performances: { id: string; groupId: string; actTime: string }[] }[];
}
export interface User { id: string; name: string; email: string; role: 'user' | 'admin' }
export interface AppState {
  competition?: CompetitionState;
  catalog: Catalog; user: User | null;
  personal: { votes: PersonalVote[]; favorites: string[]; prediction: Prediction };
  rankings: { advanced: RankingEntry[]; apto: RankingEntry[]; aguja: RankingEntry[] };
  counts: { votes: number; participants: number }; serverTime: number;
}
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
export async function api<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Requested-With': 'VotaCOAC' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch { throw new ApiError('No hay conexión. Comprueba tu red y vuelve a intentarlo.', 0); }
  let data;
  try { data = await response.json(); } catch { throw new ApiError('El servicio no responde. Vuelve a intentarlo en unos instantes.', response.status); }
  if (!response.ok) throw new ApiError(data.error || 'No se ha podido completar la operación.', response.status, data.code);
  return data as T;
}
