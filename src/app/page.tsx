'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, ArrowUpRight, Heart, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { useApp } from '@/components/app-provider';
import { GroupCard } from '@/components/group-card';
import { categoryOrder, categoryDesign, normalizeText } from '@/lib/design';
import type { ActiveView, GroupCategory, Performance } from '@/lib/types';
import { HelpView, RankingsPanel } from '@/components/carnaval-views';
import { CountUp, LoadingView, Reveal, ViewTransition, fadeUp, stagger } from '@/components/motion';
import { Bunting, Confetti, Streamer } from '@/components/carnival-decor';
import { SiteCredits } from '@/components/site-credits';
import { externalLinkProps, externalLinks } from '@/lib/links';
const PersonalView = dynamic(() => import('@/components/personal-view').then(m => m.PersonalView), { loading: () => <LoadingView label="Cargando tu Carnaval…" cards={0} /> });
const PredictionView = dynamic(() => import('@/components/prediction-view').then(m => m.PredictionView), { loading: () => <LoadingView label="Cargando tu quiniela…" cards={4} /> });
const AdminView = dynamic(() => import('@/components/admin-view').then(m => m.AdminView), { loading: () => <LoadingView label="Cargando administración…" cards={0} /> });
const viewNames: ActiveView[] = ['inicio', 'funciones', 'rankings', 'aguja', 'personal', 'quiniela', 'admin', 'ayuda', 'pronosticos', 'termometro', 'liga', 'bingo', 'comparador', 'evolucion', 'semaforo', 'fantasy'];
const ForecastView = dynamic(() => import('@/components/forecast-view').then(m => m.ForecastView), { loading: () => <LoadingView label="Cargando la quiniela por fases…" cards={0} /> });
const SupportView = dynamic(() => import('@/components/support-view').then(m => m.SupportView), { loading: () => <LoadingView label="Cargando los favoritos del público…" cards={0} /> });
const LeagueView = dynamic(() => import('@/components/league-view').then(m => m.LeagueView), { loading: () => <LoadingView label="Cargando la liga…" cards={0} /> });
const BingoView = dynamic(() => import('@/components/bingo-view').then(m => m.BingoView), { loading: () => <LoadingView label="Cargando tu cartón…" cards={0} /> });
const StatisticsView = dynamic(() => import('@/components/statistics-view').then(m => m.StatisticsView), { loading: () => <LoadingView label="Cargando estadísticas…" cards={0} /> });
const FantasyView = dynamic(() => import('@/components/fantasy-view').then(m => m.FantasyView), { loading: () => <LoadingView label="Cargando Fantasy…" cards={0} /> });
export default function HomePage() {
  const { state, loading, ready, error, refresh, openAuth } = useApp();
  const [active, setActive] = useState<ActiveView>('inicio'); const [category, setCategory] = useState<GroupCategory | 'Todas'>('Todas'); const [session, setSession] = useState('all'); const [search, setSearch] = useState('');
  useEffect(() => {
    const update = () => { const value = window.location.hash.slice(1) as ActiveView; setActive(viewNames.includes(value) ? value : 'inicio'); };
    update(); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update);
  }, []);
  const navigate = (view: ActiveView) => { setActive(view); window.history.replaceState(null, '', `${window.location.pathname}#${view}`); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const performances: Performance[] = session === 'all'
    ? state.catalog.groups.flatMap(group => { const acts = state.catalog.sessions.flatMap(s => s.performances.filter(p => p.groupId === group.id).map(p => ({ id: p.id, actTime: p.actTime, group, scheduled: true }))); return acts.length ? acts : [{ id: `pending_${group.id}`, actTime: '9999-01-01T00:00:00Z', group, scheduled: false }]; })
    : state.catalog.sessions.filter(s => s.id === session).flatMap(s => s.performances.map(p => ({ id: p.id, actTime: p.actTime, group: state.catalog.groups.find(g => g.id === p.groupId)!, scheduled: true }))).filter(p => p.group);
  const unique = performances.filter((p, i, list) => active !== 'aguja' || list.findIndex(other => other.group.id === p.group.id) === i);
  const filtered = unique.filter(p => (category === 'Todas' || p.group.category === category) && normalizeText(`${p.group.name} ${p.group.author}`).includes(normalizeText(search)));
  const homePerformances = performances.filter((p, i, list) => list.findIndex(other => other.group.id === p.group.id) === i).slice(0, 3);
  const edition = state.catalog.edition;
  const tools = [{ id: 'termometro', module: 'support', title: 'Los favoritos del público', text: 'Una favorita por modalidad, antes del concurso.', tone: 'pink' }, { id: 'pronosticos', module: 'predictions', title: 'La Quiniela', text: 'Semifinalistas, finalistas, ganadores y puestos.', tone: 'yellow' }, { id: 'liga', module: 'league', title: 'Liga VotaCOAC', text: 'Aciertos, puntos y ligas con tus amigos.', tone: 'green' }, { id: 'bingo', module: 'bingo', title: 'Bingo del Falla', text: 'Tu cartón para seguir cada función.', tone: 'orange' }, { id: 'comparador', module: 'comparison', title: 'Cara a cara', text: 'Compara agrupaciones con datos reales.', tone: 'blue' }, { id: 'evolucion', module: 'evolution', title: 'Las curvas del concurso', text: 'Fases, medias, votos y posición popular.', tone: 'pink' }].filter(item => !state.competition || state.competition.config.modules[item.module as keyof typeof state.competition.config.modules]);
  const openCategory = (cat: GroupCategory) => { setCategory(cat); navigate('funciones'); };
  return <div className="site-shell"><PageHeader activeView={active} setActiveView={navigate} />
    <main className="site-width main-content" id="contenido">
      <div className="edition-strip"><span className="edition-badge">✦ {edition.name}</span><span>{edition.demo ? 'Edición de prueba · Agrupaciones ficticias' : 'Carnaval de Cádiz'}</span><button onClick={() => navigate('ayuda')}>Cómo funciona <ArrowUpRight size={15} /></button></div>
      <AnimatePresence initial={false}>{error && <motion.div key="notice" className="service-notice" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><span><AlertTriangle size={18} aria-hidden="true" />{error}</span><button onClick={() => { void refresh(); }}>Reintentar</button></motion.div>}</AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
      <ViewTransition key={active} id={active}>
      {active === 'inicio' && <>
        <section className="home-hero" aria-labelledby="hero-title">
          <Bunting className="hero-bunting" />
          <Confetti className="absolute inset-0 -z-0 h-full w-full opacity-70" />
          <motion.div className="hero-copy" initial="hidden" animate="show" variants={stagger(0.09, 0.1)}>
            <motion.span className="hero-kicker" variants={fadeUp}>DEL PATIO DE BUTACAS AL JURADO</motion.span>
            <motion.h1 id="hero-title" variants={fadeUp}>El carnaval<br />también lleva<br /><span className="serif">tu voz.</span></motion.h1>
            <motion.p variants={fadeUp}>Elige tus favoritas, puntúa cada actuación y vive el concurso a tu manera.</motion.p>
            <motion.div className="hero-actions" variants={fadeUp}><button className="action-button action-yellow" onClick={() => navigate('funciones')}>Quiero votar <ArrowRight size={18} /></button><button className="hero-link" onClick={() => navigate('rankings')}>Ver los rankings <ArrowUpRight size={17} /></button></motion.div>
            <motion.div className="hero-footnote" variants={fadeUp}>COAC 2027 <span>✦</span> Cádiz tiene mucho que decir.</motion.div>
          </motion.div>
          <motion.div className="hero-scene" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
            <Streamer className="-left-6 top-24 w-40 opacity-90" color="#C92168" />
            <div className="hero-scene-heading"><span>Nos vemos<br />en el Falla.</span><Sparkles size={30} aria-hidden="true" /></div>
            <div className="theatre-frame"><img src="/art/carnaval-falla.webp" alt="Ilustración del Gran Teatro Falla de Cádiz" width="900" height="600" fetchPriority="high" /></div>
            <motion.span className="scene-sticker" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 10 }} whileHover={{ rotate: -4, scale: 1.06 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.7 }}>EL JURADO<br /><strong>ERES TÚ</strong></motion.span>
          </motion.div>
        </section>
        <Reveal as="section" className="home-stats"><div><strong><CountUp value={state.catalog.groups.length} pad={2} locale={false} /></strong><span>{edition.demo ? 'Agrupaciones de ejemplo' : 'Agrupaciones en el listado'}</span></div><div><strong><CountUp value={state.catalog.sessions.length} pad={2} locale={false} /></strong><span>{edition.demo ? 'Sesiones para probar' : state.catalog.sessions.length ? 'Funciones publicadas' : 'Calendario pendiente'}</span></div><div><strong>{ready ? <CountUp value={state.counts.votes} /> : '—'}</strong><span>Votos de la comunidad</span></div><button onClick={() => state.user ? navigate('personal') : openAuth('register')}><span>{state.user ? `¡Hola, ${state.user.name.split(' ')[0]}!` : 'Tu Carnaval empieza aquí'}</span><strong>{state.user ? 'Ver mi actividad' : 'Crear una cuenta gratis'} <ArrowUpRight size={20} /></strong></button></Reveal>
        <motion.section className="category-band" aria-label="Modalidades" initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -40px 0px' }} variants={stagger(0.07)}>{categoryOrder.map(cat => { const count = state.catalog.groups.filter(g => g.category === cat).length; return <motion.button key={cat} className="category-chip" data-category={cat} variants={fadeUp} whileTap={{ scale: 0.97 }} onClick={() => openCategory(cat)}><strong>{categoryDesign[cat].plural}</strong><span>{categoryDesign[cat].caption}</span><small>{count} {count === 1 ? 'agrupación' : 'agrupaciones'} →</small></motion.button>; })}</motion.section>
        <section className="featured-section"><Reveal className="section-heading"><div><span className="mini-label">Cada modalidad, su arte</span><h2>¿Quién te ha <span className="serif">ganado?</span></h2></div><button className="text-link" onClick={() => navigate('funciones')}>Todas las agrupaciones <ArrowRight size={18} /></button></Reveal><div className="group-grid">{homePerformances.map((p, i) => <GroupCard key={p.id} performance={p} index={i} />)}</div><p className="demo-footnote">{edition.notice} {edition.demo && 'Los votos son de prueba y no forman parte del concurso oficial.'}</p></section>
        <motion.section className="discover-grid" aria-label="Más formas de vivir el concurso" initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -60px 0px' }} variants={stagger(0.08)}>
          <motion.button variants={fadeUp} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} className="discover-block prediction-promo" onClick={() => navigate('quiniela')}><span>HAZ TUS APUESTAS</span><h2>Tu quiniela.<br /><span className="serif">Tu intuición.</span></h2><p>Ordena a tus favoritas por modalidad y guarda tu pronóstico.</p><span className="discover-link">Preparar mi quiniela <ArrowUpRight size={20} /></span></motion.button>
          <motion.button variants={fadeUp} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} className="discover-block needle-promo" onClick={() => navigate('aguja')}><span>EL TIPO TAMBIÉN CUENTA</span><h2>Un premio<br /><span className="serif">con mucho tipo.</span></h2><p>Valora el vestuario y la puesta en escena en la Aguja de Oro.</p><span className="discover-link">Votar Aguja de Oro <ArrowUpRight size={20} /></span></motion.button>
          <motion.button variants={fadeUp} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} className="discover-block community-promo" onClick={() => navigate('rankings')}><span>ASÍ LO VE LA AFICIÓN</span><h2>El veredicto<br /><span className="serif">de la gente.</span></h2><p>Consulta las medias y el porcentaje de aptos de la comunidad.</p><span className="discover-link">Consultar resultados <ArrowUpRight size={20} /></span></motion.button>
        </motion.section>
        {tools.length > 0 && <section className="new-tools"><Reveal className="section-heading"><div><span className="mini-label">Más formas de participar</span><h2>Tu concurso tiene <span className="serif">más juego.</span></h2></div></Reveal><motion.div className="tools-grid" initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -40px 0px' }} variants={stagger(0.06)}>{tools.map((item, i) => <motion.button variants={fadeUp} whileTap={{ scale: 0.98 }} className={`tool-tile tool-${item.tone}`} key={item.id} onClick={() => navigate(item.id as ActiveView)}><em>{String(i + 1).padStart(2, '0')}</em><h3>{item.title}</h3><p>{item.text}</p><span>Explorar <ArrowRight size={16} /></span></motion.button>)}</motion.div></section>}
        <section className="shop-section" aria-labelledby="shop-title"><Reveal>
          <div className="shop-banner">
            <span className="shop-icon" aria-hidden="true"><ShoppingBag size={28} /></span>
            <div className="shop-copy"><span className="mini-label">En colaboración</span><h2 id="shop-title">Tienda de <span className="serif">Al Son del Carnaval</span></h2></div>
            <a className="action-button action-yellow shop-button" href={externalLinks.shop} {...externalLinkProps}>Visitar la tienda <ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> (se abre en otra pestaña)</span></a>
          </div>
          <SiteCredits className="home-credits" />
        </Reveal></section>
        <section className="home-bottom"><Reveal><HelpView compact /></Reveal><Reveal as="aside" className="join-panel" delay={0.1}><Heart size={30} aria-hidden="true" /><h2>Hazlo <span className="serif">tuyo.</span></h2><p>Un solo lugar para tus votos, tus favoritas y tus pronósticos.</p><button className="action-button action-white" onClick={() => state.user ? navigate('personal') : openAuth('register')}>{state.user ? 'Ir a Mi Carnaval' : 'Unirme a VotaCOAC'} <ArrowRight size={17} /></button></Reveal></section>
      </>}
      {(active === 'funciones' || active === 'aguja') && <>
        <section className={`page-intro ${active === 'aguja' ? 'intro-orange' : 'intro-blue'}`}><div><span className="mini-label">{active === 'aguja' ? 'Vestuario y puesta en escena' : 'El concurso, a tu manera'}</span><h1>{active === 'aguja' ? 'Aguja de Oro' : 'Agrupaciones'}</h1><p>{active === 'aguja' ? 'Un voto del 1 al 10 para el tipo que más te gusta.' : 'Busca una agrupación y elige cómo quieres votar.'}</p></div><span className="intro-number" aria-hidden="true">{state.catalog.groups.length.toString().padStart(2, '0')}</span></section>
        <div className="programme-toolbar"><div className="category-filters" aria-label="Filtrar por modalidad">{(['Todas', ...categoryOrder] as const).map(cat => <motion.button whileTap={{ scale: 0.95 }} key={cat} className={`category-filter ${category === cat ? 'selected' : ''}`} data-category={cat} aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat === 'Todas' ? 'Todas' : categoryDesign[cat].plural}<span>{cat === 'Todas' ? unique.length : unique.filter(p => p.group.category === cat).length}</span></motion.button>)}</div><div className="programme-controls"><label className="search-label"><span className="sr-only">Buscar agrupación o autor</span><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar agrupación o autor…" /></label><label><span className="sr-only">Sesión</span><select value={session} onChange={e => setSession(e.target.value)}><option value="all">Todas las sesiones</option>{state.catalog.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div></div>
        <div className="results-line" aria-live="polite"><span>{filtered.length} {filtered.length === 1 ? 'agrupación' : 'agrupaciones'}</span><span>{edition.votingOpen ? 'Registro gratuito para votar' : 'Votación cerrada por el administrador'}</span></div>
        <div className="group-grid">{filtered.map((p, i) => <GroupCard key={`${active}-${p.id}`} performance={p} index={i} aguja={active === 'aguja'} />)}</div>{!filtered.length && <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><span className="empty-number" aria-hidden="true">?</span><h3>No hay coincidencias</h3><p>Prueba otro nombre o cambia los filtros.</p><button className="action-button action-white" onClick={() => { setSearch(''); setSession('all'); setCategory('Todas'); }}>Ver todas</button></motion.div>}
        <p className="demo-footnote">{edition.notice}</p>
      </>}
      {active === 'pronosticos' && <ForecastView />}
      {active === 'termometro' && <SupportView />}
      {active === 'liga' && <LeagueView onNavigate={navigate} />}
      {active === 'bingo' && <BingoView />}
      {(['comparador', 'evolucion', 'semaforo'] as ActiveView[]).includes(active) && <StatisticsView key={active} mode={active as 'comparador' | 'evolucion' | 'semaforo'} />}
      {active === 'fantasy' && <FantasyView />}
      {active === 'rankings' && <RankingsPanel onNavigate={navigate} />}
      {active === 'personal' && <PersonalView onNavigate={navigate} />}
      {active === 'quiniela' && <PredictionView />}
      {active === 'admin' && <AdminView />}
      {active === 'ayuda' && <><div className="page-intro intro-yellow"><div><span className="mini-label">Todo lo que necesitas saber</span><h1>Vamos por partes.</h1><p>Así funciona tu voto en VotaCOAC.</p></div></div><HelpView /></>}
      </ViewTransition>
      </AnimatePresence>
      {loading && <span className="sr-only" role="status">Conectando con la comunidad</span>}
    </main>
    <footer className="site-footer"><Bunting className="footer-bunting" tone="dark" flags={24} /><div className="site-width footer-content"><div><button className="footer-wordmark" onClick={() => navigate('inicio')}>vota<span>COAC.</span></button><p>El carnaval lo hacemos entre todos.</p></div><nav aria-label="Pie de página"><button onClick={() => navigate('ayuda')}>Cómo funciona</button><button onClick={() => navigate('personal')}>Mi cuenta</button><a href="https://carnavalinense.es" target="_blank" rel="noreferrer">Carnavalinense <ArrowUpRight size={14} /></a><a href={externalLinks.shop} {...externalLinkProps}>Tienda <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (se abre en otra pestaña)</span></a></nav><div className="footer-edition"><strong>{edition.name}</strong><span>{edition.demo ? 'Demo · Datos ficticios' : 'Votación popular independiente'}</span></div></div><div className="site-width footer-credit"><SiteCredits /></div><div className="site-width footer-bottom"><span>Proyecto independiente. Sin vinculación con el jurado oficial del COAC.</span><span>Hecho con afición, desde Cádiz.</span></div></footer>
  </div>;
}
