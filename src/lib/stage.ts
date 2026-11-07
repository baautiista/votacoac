import type { CompetitionConfig, ContestStage } from './competition';
import type { ActiveView } from './types';

/** Etapa publicada por administración. Una configuración antigua sin etapa equivale a «antes». */
export const stageOf = (config?: CompetitionConfig | null): ContestStage => config?.stage === 'durante' ? 'durante' : 'antes';

export type StageArea = ContestStage;
export type ModuleKey = keyof CompetitionConfig['modules'];

export interface StageFeature {
  id: string;
  view: ActiveView;
  module?: ModuleKey;
  title: string;
  kicker: string;
  text: string;
  /** Lo que se podrá hacer, para la presentación bloqueada. */
  promise?: string[];
  tone: 'blue' | 'pink' | 'yellow' | 'green' | 'orange';
}

/** Área 1 · Antes del concurso: disponible ahora. */
export const beforeFeatures: StageFeature[] = [
  { id: 'quiniela', view: 'pronosticos', module: 'predictions', kicker: 'La quiniela del público', title: 'Elige tus cinco', text: 'Cinco agrupaciones por modalidad. Guarda tu elección y comprueba tus aciertos al terminar.', tone: 'yellow' },
  { id: 'ligas', view: 'liga', module: 'league', kicker: 'Ligas privadas', title: 'Crea tu liga', text: 'Invita a tu peña y compara vuestros aciertos con las reglas de la Liga.', tone: 'green' },
  { id: 'agrupaciones', view: 'funciones', kicker: 'Agrupaciones', title: 'Explora el cartel', text: 'Busca por modalidad, autor o nombre y guarda las que quieras seguir.', tone: 'blue' },
  { id: 'bingo-libre', view: 'bingo', module: 'bingo', kicker: 'Bingo personal', title: 'Escribe tus diez casillas', text: 'Tu propio cartón, con situaciones como «Cuplé a Andy y Lucas» y validación individual.', tone: 'orange' },
];

/** Área 2 · Durante el concurso: se activa desde administración. */
export const duringFeatures: StageFeature[] = [
  { id: 'votaciones', view: 'funciones', kicker: 'Votaciones de actuaciones', title: 'Vota cada actuación', text: 'Apto o no apto, puntuación detallada y Aguja de Oro para el tipo.', promise: ['Voto por actuación', 'Puntuación avanzada', 'Aguja de Oro'], tone: 'blue' },
  { id: 'rankings', view: 'rankings', kicker: 'Rankings y semáforo', title: 'El veredicto del público', text: 'Clasificaciones populares y el semáforo de cada actuación con votos reales.', promise: ['Podio por modalidad', 'Semáforo por actuación'], tone: 'pink' },
  { id: 'seguimiento', view: 'evolucion', module: 'evolution', kicker: 'Funciones y evolución', title: 'Sigue el concurso', text: 'Fichas, curvas por fase y cara a cara entre agrupaciones.', promise: ['Evolución por fase', 'Comparador cara a cara'], tone: 'green' },
  { id: 'bingo-funcion', view: 'bingo', module: 'bingo', kicker: 'Bingo de cada función', title: 'Un cartón por función', text: 'Marca lo que pasa en el escenario y entra en la clasificación de la noche.', promise: ['Diez casillas personalizables', 'Validación de administración'], tone: 'orange' },
];

/** Vistas que pertenecen al área «Durante el concurso». */
export const duringViews: ActiveView[] = ['aguja', 'rankings', 'semaforo', 'comparador', 'evolucion'];
export const isDuringView = (view: ActiveView) => duringViews.includes(view);
