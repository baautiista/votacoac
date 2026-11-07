'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig, animate, motion, useInView, useReducedMotion, type Variants } from 'framer-motion';

/** Sistema de movimiento compartido. `reducedMotion="user"` desactiva transformaciones si el sistema lo pide. */
export const ease = [0.22, 1, 0.36, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.45, ease }}>{children}</MotionConfig>;
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Entrada al hacer scroll, una sola vez. */
export function Reveal({ children, className, delay = 0, as = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'aside' }) {
  const Tag = motion[as];
  return <Tag className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -60px 0px' }} variants={{ hidden: fadeUp.hidden, show: { ...(fadeUp.show as object), transition: { duration: 0.55, ease, delay } } }}>{children}</Tag>;
}

/** Transición entre vistas. */
export function ViewTransition({ id, children }: { id: string; children: ReactNode }) {
  return <motion.div key={id} className="view-stage" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }} transition={{ duration: 0.4, ease }}>{children}</motion.div>;
}

/** Cifra que cuenta hasta su valor real cuando entra en pantalla. */
export function CountUp({ value, pad = 0, locale = true }: { value: number; pad?: number; locale?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null); const inView = useInView(ref, { once: true }); const reduce = useReducedMotion();
  const format = (n: number) => { const rounded = Math.round(n); return locale ? rounded.toLocaleString('es') : String(rounded).padStart(pad, '0'); };
  const [display, setDisplay] = useState(() => format(0)); const shown = useRef(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { shown.current = value; setDisplay(format(value)); return; }
    const controls = animate(shown.current, value, { duration: 1.1, ease, onUpdate: v => { shown.current = v; setDisplay(format(v)); } });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);
  return <><span ref={ref} aria-hidden="true">{display}</span><span className="sr-only">{format(value)}</span></>;
}

/** Estado de carga con esqueletos. */
export function LoadingView({ label, cards = 3 }: { label: string; cards?: number }) {
  return <div className="loading-view" role="status" aria-live="polite">
    <div className="skeleton" style={{ height: 180, borderRadius: 26 }} />
    <span className="loading-caption"><span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>{label}</span>
    {cards > 0 && <div className="skeleton-grid" aria-hidden="true">{Array.from({ length: cards }, (_, i) => <div className="skeleton" key={i} />)}</div>}
  </div>;
}
