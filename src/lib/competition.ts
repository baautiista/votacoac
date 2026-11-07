import type { GroupCategory, RankingEntry, Group } from './types';
import type { Prediction } from './api';
export const forecastPhases = ['semifinales', 'final', 'ganador'] as const;
export type ForecastPhase = typeof forecastPhases[number];
export const phaseLabels: Record<string, string> = { preliminares: 'Preliminares', cuartos: 'Cuartos', semifinales: 'Semifinales', final: 'Gran Final', ganador: 'Ganadores' };
export interface WindowConfig { enabled?: boolean; open?: boolean; opensAt: string | null; closesAt: string | null }
export type ContestStage = 'antes' | 'durante';
export interface CompetitionConfig {
  /** Etapa visible del concurso. Las configuraciones antiguas pueden no tenerla: se interpreta como «antes». */
  stage?: ContestStage;
  version: number;
  modules: Record<'predictions' | 'support' | 'traffic' | 'comparison' | 'evolution' | 'bingo' | 'league' | 'fantasy', boolean>;
  forecasts: Record<ForecastPhase, WindowConfig & { enabled: boolean; limits: Record<GroupCategory, number> }>;
  points: { semifinales: number; final: number; ganador: number; exactPosition: number };
  support: WindowConfig & { open: boolean };
  traffic: { minVotes: number; excellent: number; good: number; regular: number };
  bingo: WindowConfig & { open: boolean; competitive: boolean; situations: { id: string; text: string }[] };
  fantasy: { enabled: boolean; publicUrl: string; budget: number; roster: Record<GroupCategory, number>; prices: Record<string, number> };
  phaseOrder: string[];
}
export interface Traffic { level: 'insufficient' | 'excellent' | 'good' | 'regular' | 'bad'; label: string; value: number | null; count: number; minimum: number; source?: string }
export interface Metrics { groupId: string; advanced: { average: number; count: number } | null; apto: { average: number; count: number } | null; aguja: { average: number; count: number } | null; position?: number | null }
export interface Badge { id: string; name: string }
export interface CompetitionState {
  config: CompetitionConfig; revision: number;
  windows: Record<ForecastPhase, { open: boolean; reason: string }>;
  traffic: Record<string, Traffic>; metrics: Record<string, Metrics>;
  publications: { phase: string; category: string; source: string; published_at: number }[];
  personal: { forecasts: Partial<Record<ForecastPhase, { selection: Prediction; updatedAt: number }>>; support: Partial<Record<GroupCategory, string>>; handle: string | null; points: number; hits: number; exactHits: number; position: number | null; badges: Badge[] };
}
export interface LeagueEntry { position: number; userId: string; handle: string; points: number; hits: number; exactHits: number; participations: number; badges: Badge[] }
export interface LeagueData { nextOffset: number | null; ranking: LeagueEntry[]; editions: { id: string; name: string }[]; edition: { id: string; name: string }; scoring: CompetitionConfig['points']; officialResults: OfficialResult[] }
export interface OfficialResult { phase: string; category: GroupCategory; groupId: string; position: number | null; source: string; updatedAt: number }
export interface SupportData { votes: { category: GroupCategory; groupId: string; votes: number; percentage: number }[]; totals: Record<GroupCategory, number>; participants: number; window: { open: boolean; reason: string }; history: { category: GroupCategory; at: number; snapshot: { groupId: string; votes: number }[] }[] }
export interface GroupInsight {
  group: Group; average: number | null; count: number; position: number | null;
  performances: { id: string; actTime: string; sessionId: string; sessionName: string; phase: string; metrics: Metrics; traffic: Traffic }[];
  phases: { phase: string; status: 'participates' | 'not_participating' | 'unknown'; average: number | null; count: number; officialPosition: number | null; officialSource: string | null }[];
  history: (Metrics & { performanceId: string; phase: string; at: number })[];
}
export interface InsightData { groups: GroupInsight[]; headToHead: { phase: string; a: number; b: number; winner: string | null }[]; officialResults: OfficialResult[]; thresholds: CompetitionConfig['traffic'] }
export interface BingoCard { id: string; sessionId: string; cells: { id: string; text: string }[]; marked: number[]; lines: string[]; bingo: boolean; verified: { marked: number[]; lines: string[]; bingo: boolean }; updatedAt: number }
export interface BingoData { readAt: number; sessionId: string; practice: boolean; competitive: boolean; window: { open: boolean; reason: string }; confirmed: string[]; card: BingoCard | null }
export const emptyPrediction = (): Prediction => ({ Coro: [], Comparsa: [], Chirigota: [], Cuarteto: [] });
