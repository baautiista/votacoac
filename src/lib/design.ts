import type { GroupCategory } from './types';

export const categoryOrder: GroupCategory[] = ['Coro', 'Comparsa', 'Chirigota', 'Cuarteto'];
export const categoryDesign: Record<GroupCategory, { plural: string; color: string; ink: string; pale: string; caption: string }> = {
  Coro: { plural: 'Coros', color: '#C92168', ink: '#A11450', pale: '#FCEAF1', caption: 'Cádiz a muchas voces' },
  Comparsa: { plural: 'Comparsas', color: '#3B84FA', ink: '#2465BE', pale: '#E6EEFF', caption: 'El pellizco que se queda' },
  Chirigota: { plural: 'Chirigotas', color: '#F2BE26', ink: '#171344', pale: '#FFF6DA', caption: 'Que no falte la guasa' },
  Cuarteto: { plural: 'Cuartetos', color: '#8BD557', ink: '#244D0D', pale: '#EFF8E7', caption: 'El arte de sorprender' },
};
export const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
