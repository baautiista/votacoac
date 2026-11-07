import { externalLinkProps, externalLinks } from '@/lib/links';

/** Crédito de la web: «Web desarrollada por Carnavalinense, en colaboración con Al Son del Carnaval.» */
export function SiteCredits({ className = '' }: { className?: string }) {
  return <p className={`site-credits ${className}`}>
    Web desarrollada por{' '}
    <a href={externalLinks.carnavalinense} {...externalLinkProps}>Carnavalinense<span className="sr-only"> (Instagram, se abre en otra pestaña)</span></a>, en colaboración con{' '}
    <a href={externalLinks.alSonDelCarnaval} {...externalLinkProps}>Al Son del Carnaval<span className="sr-only"> (Instagram, se abre en otra pestaña)</span></a>.
  </p>;
}
