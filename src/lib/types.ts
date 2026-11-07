
export type GroupCategory = 'Coro' | 'Comparsa' | 'Chirigota' | 'Cuarteto';

export type ActiveView = 'termometro' | 'semaforo' | 'comparador' | 'evolucion' | 'pronosticos' | 'liga' | 'bingo' | 'fantasy' | 'inicio' | 'ayuda' | 'funciones' | 'rankings' | 'aguja' | 'personal' | 'admin' | 'quiniela' | 'previa' | 'concurso';

export interface Group {
  id: string;
  name: string;
  category: GroupCategory;
  author: string;
  imageUrl: string;
  imageHint: string;
  description?: string;
  locality?: string;
  director?: string;
  source?: string;
  needsReview?: boolean;
  sourceLabel?: string;
}

export interface Performance {
  scheduled?: boolean;
  id: string;
  group: Group;
  actTime: string; // ISO 8601 string
}

export interface Session {
  id:string;
  name: string;
  location: string;
  date: string; // e.g., "Domingo 11 de enero"
  time: string; // e.g., "20:00 h"
  performances: Performance[];
}

export interface RankingEntry {
  groupId?: string;
  position: number;
  groupName: string;
  category: GroupCategory;
  averageScore: number;
  voteCount: number;
}

export interface PersonalVote {
  id?: string;
  groupId?: string;
  createdAt?: number;
  groupName: string;
  category: GroupCategory;
  votingType: 'Normal' | 'Avanzado' | 'Apto/No Apto' | 'Aguja de Oro';
  score?: number;
  apto?: boolean;
  performanceId: string;
}

    
