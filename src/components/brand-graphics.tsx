import { cn } from '@/lib/utils';

/** Decorative stage geometry using the five colors of the VotaCOAC identity. */
export function StageGraphic({ className }: { className?: string }) {
  return <svg className={cn('stage-graphic', className)} viewBox="0 0 260 190" fill="none" aria-hidden="true" focusable="false">
    <circle cx="184" cy="75" r="74" fill="#3B84FA" />
    <path d="M119 174V78a52 52 0 0 1 104 0v96H119Z" fill="#EFF9F0" />
    <path d="M137 174V82a34 34 0 0 1 68 0v92h-68Z" fill="#13315C" />
    <path d="M141 89c14 0 25 16 29 34-6 13-15 24-29 30V89Z" fill="#EF476F" />
    <path d="M201 89c-14 0-25 16-29 34 6 13 15 24 29 30V89Z" fill="#BF1363" />
    <path d="M102 174h138v8H102z" fill="#EF476F" />
    <path d="M91 182h160v8H91z" fill="#EFF9F0" />
    <path d="M31 66h55v78H31z" fill="#BF1363" />
    <path d="M31 66a27.5 27.5 0 0 1 55 0H31Z" fill="#EF476F" />
    <path d="M48 83h20v61H48z" fill="#13315C" />
    <path d="M23 144h71v8H23z" fill="#3B84FA" />
    <path d="m100 17 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" fill="#EFF9F0" />
    <circle cx="233" cy="20" r="6" fill="#EF476F" />
    <path d="m18 106 5 5m-5 0 5-5" stroke="#EFF9F0" strokeWidth="2" strokeLinecap="round" />
    <path d="M53 16v12m-6-6h12" stroke="#3B84FA" strokeWidth="2" strokeLinecap="round" />
    <circle cx="236" cy="136" r="5" stroke="#EFF9F0" strokeWidth="2" />
  </svg>;
}
