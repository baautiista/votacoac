'use client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const flagColors = ['#F2BE26', '#C92168', '#FFFFFF', '#8BD557', '#FF7B2E', '#171344'];

/** Banderines de carnaval colgando de un cordel. Decorativo. */
export function Bunting({ className, flags = 18, tone = 'light' }: { className?: string; flags?: number; tone?: 'light' | 'dark' }) {
  const width = 1200; const step = width / flags; const sag = 22;
  const half = width / 2; const y = (x: number) => { const t = (x % half) / half; return 6 + 4 * sag * t * (1 - t); };
  return <svg className={cn('bunting', className)} viewBox={`0 0 ${width} 70`} preserveAspectRatio="none" width="100%" height="56" aria-hidden="true" focusable="false">
    <path d={`M0 6 Q ${width / 4} ${6 + sag * 2} ${half} 6 Q ${width * 0.75} ${6 + sag * 2} ${width} 6`} stroke={tone === 'dark' ? '#ffffff55' : '#17134455'} strokeWidth="1.5" fill="none" />
    {Array.from({ length: flags }, (_, i) => {
      const x = step * i + step / 2; const top = y(x) - 1;
      const color = flagColors[(i + (tone === 'dark' ? 1 : 0)) % flagColors.length];
      return <motion.path key={i} d={`M${x - step * 0.34} ${top} L${x + step * 0.34} ${top} L${x} ${top + 30} Z`} fill={color} stroke={color === '#FFFFFF' ? '#17134422' : 'none'}
        style={{ transformOrigin: `${x}px ${top}px` }} initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: 0.15 + i * 0.025, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />;
    })}
  </svg>;
}

/** Serpentina ondulada que se dibuja al aparecer. Decorativo. */
export function Streamer({ className, color = '#F2BE26', d = 'M4 80 C 40 10, 80 150, 120 70 S 200 10, 236 70' }: { className?: string; color?: string; d?: string }) {
  return <svg className={cn('hero-streamer', className)} viewBox="0 0 240 150" fill="none" aria-hidden="true" focusable="false">
    <motion.path d={d} stroke={color} strokeWidth="7" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }} />
  </svg>;
}

/** Confeti estático en posiciones fijas (sin aleatoriedad para evitar desajustes de hidratación). */
export function Confetti({ className }: { className?: string }) {
  const bits = [[8, 18, '#F2BE26', 0], [22, 62, '#FFFFFF', 30], [38, 30, '#C92168', 70], [55, 76, '#8BD557', 15], [70, 22, '#FF7B2E', 45], [86, 58, '#FFFFFF', 80], [93, 14, '#F2BE26', 20]] as const;
  return <svg className={cn('confetti', className)} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {bits.map(([x, y, c, r], i) => <rect key={i} x={x} y={y} width="2.2" height="1.1" rx=".4" fill={c} transform={`rotate(${r} ${x} ${y})`} />)}
  </svg>;
}
