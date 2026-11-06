import catalog from './demo-catalog.json';
import type { Group, Session } from './types';

export const edition = catalog.edition;
export const allGroups = catalog.groups as Group[];
export const sessions: Session[] = catalog.sessions.map(session => ({
  ...session,
  performances: session.performances.map(performance => ({
    id: performance.id,
    actTime: performance.actTime,
    group: allGroups.find(group => group.id === performance.groupId)!,
  })),
}));
export const groupActTimes = new Map(sessions.flatMap(session => session.performances.map(p => [p.group.id, p.actTime] as const)));
