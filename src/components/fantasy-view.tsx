'use client';
import { ComingSoonSign } from './stage-ui';
export function FantasyView() {
  return <section className="coming-soon fantasy-coming" aria-labelledby="fantasy-title"><div className="coming-stage"><span className="proscenium-arch" aria-hidden="true" /><span className="curtain curtain-left is-closed" aria-hidden="true" /><span className="curtain curtain-right is-closed" aria-hidden="true" /><div className="coming-copy"><ComingSoonSign /><span className="mini-label">El próximo juego del Carnaval</span><h1 id="fantasy-title">Fantasy COAC</h1><p>Tu equipo de agrupaciones, tu forma de vivir el concurso.</p><strong className="fantasy-soon-label">Próximamente</strong><p>Te avisaremos aquí cuando esté disponible.</p></div></div><div className="coming-actions"><a className="action-button action-blue" href="#pronosticos">Mientras tanto, elige tus cinco →</a></div></section>;
}
