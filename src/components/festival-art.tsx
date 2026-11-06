import { categoryDesign } from '@/lib/design';
import type { GroupCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

export function FestivalStar({ className }: { className?: string }) {
  return <svg viewBox="0 0 40 40" fill="none" className={cn('festival-star', className)} aria-hidden="true"><path d="m20 0 4.4 12.4L36 4l-8.4 11.6L40 20l-12.4 4.4L36 36l-11.6-8.4L20 40l-4.4-12.4L4 36l8.4-11.6L0 20l12.4-4.4L4 4l11.6 8.4L20 0Z" fill="currentColor"/></svg>;
}

export function CategoryEmblem({ category, className }: { category: GroupCategory; className?: string }) {
  const d = categoryDesign[category];
  return <svg viewBox="0 0 160 150" fill="none" className={className} aria-hidden="true">
    <circle cx="79" cy="78" r="58" fill={d.color} opacity=".09"/>
    <path d="m134 17 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9ZM25 108l2.5 7.5 7.5 2.5-7.5 2.5-2.5 7.5-2.5-7.5-7.5-2.5 7.5-2.5 2.5-7.5Z" fill={d.color}/>
    <circle cx="25" cy="40" r="4" fill="#EF476F"/><circle cx="135" cy="109" r="4" fill="#F8D477"/>
    {category === 'Coro' && <>
      <path d="M30 95c0-27 21-53 50-67 29 14 50 40 50 67L80 128 30 95Z" fill="#BF1363"/>
      <path d="m80 128-31-42M80 128V37m0 91 31-42M80 128 64 51m16 77 16-77" stroke="#FCE4EF" strokeWidth="3"/>
      <path d="M34 94c6-10 16-9 23-3 7-12 16-10 23-3 7-7 16-9 23 3 7-6 17-7 23 3" stroke="#F8D477" strokeWidth="5"/>
      <circle cx="80" cy="127" r="8" fill="#F8D477"/>
    </>}
    {category === 'Comparsa' && <g transform="rotate(24 80 75)">
      <path d="M82 48h14v50H82z" fill="#13315C"/><path d="M78 23h22l-3 30H81z" fill="#3B84FA"/>
      <path d="M79 76c-18-15-37 0-35 16-21 24-5 46 23 43 26 3 42-19 22-42 2-8-1-14-10-17Z" fill="#F8D477"/>
      <path d="M69 83c-11-6-24 3-22 13-15 20-4 34 20 32 19 0 31-14 17-32" stroke="#E9B451" strokeWidth="2"/>
      <circle cx="68" cy="101" r="12" fill="#13315C"/><path d="M67 28v91m5-91v91" stroke="#EFF9F0" strokeWidth="1.5"/><path d="M55 119h28" stroke="#13315C" strokeWidth="5"/>
      <path d="M75 30h7m15 1h7m-29 11h7m15 0h7" stroke="#13315C" strokeWidth="3"/>
    </g>}
    {category === 'Chirigota' && <>
      <path d="m34 40 26 14 21-18 21 18 25-14-9 43H43l-9-43Z" fill="#F8D477"/>
      <circle cx="34" cy="38" r="7" fill="#EF476F"/><circle cx="81" cy="33" r="7" fill="#BF1363"/><circle cx="128" cy="38" r="7" fill="#EF476F"/>
      <path d="M35 77c17-10 31-3 45 4 14-7 28-14 45-4-2 34-17 52-45 50-28 2-43-16-45-50Z" fill="#EF476F"/>
      <path d="M46 90c8-10 19-10 27 1m14 0c8-11 19-11 27-1" stroke="#13315C" strokeWidth="6" strokeLinecap="round"/>
      <path d="M63 109c9 9 25 9 34 0" stroke="#EFF9F0" strokeWidth="5" strokeLinecap="round"/>
    </>}
    {category === 'Cuarteto' && <>
      <path d="M31 56h98v58H31z" fill="#3B84FA"/><path d="M25 52h110v12H25z" fill="#13315C"/>
      <path d="M30 40h100v16H30z" fill="#F8D477"/>
      <path d="M31 64h25c-2 23-9 34-25 45V64Zm98 0h-25c2 23 9 34 25 45V64Z" fill="#BF1363"/>
      <path d="M49 41 61 55m9-14 12 14m9-14 12 14m9-14 12 14" stroke="#EFF9F0" strokeWidth="5"/>
      <path d="M57 96c0-13 10-23 23-23s23 10 23 23v18H57V96Z" fill="#13315C"/>
      <path d="M24 114h112v12H24z" fill="#F8D477"/>
      <path d="m80 79 4 9 10 1-8 7 2 10-8-5-9 5 3-10-8-7 10-1 4-9Z" fill="#EFF9F0"/>
    </>}
  </svg>;
}

export function TicketArt({ className }: { className?: string }) {
 return <svg viewBox="0 0 250 180" fill="none" className={className} aria-hidden="true"><g transform="rotate(-13 125 90)"><path d="M25 39h200v32a17 17 0 0 0 0 34v32H25v-32a17 17 0 0 0 0-34V39Z" fill="#EF476F"/><path d="M39 52h172v71H39z" stroke="#FFF" strokeWidth="2" strokeDasharray="5 5"/><path d="M165 41v94" stroke="#BF1363" strokeWidth="2" strokeDasharray="5 5"/><path d="m94 61 8 17 19 3-14 13 3 19-16-9-17 9 4-19-14-13 19-3 8-17Z" fill="#F8D477"/><path d="M180 63v46m7-46v46m7-46v46" stroke="#EFF9F0" strokeWidth="3"/></g></svg>;
}
