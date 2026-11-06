# Informe de ampliación de VotaCOAC 2027

Fecha: 7 de noviembre de 2026 · Europe/Madrid.
Sitio: https://votacoac.miguelbaulim.chatgpt.site

## Alcance y conservación

Se amplía el mismo proyecto, con su identidad, acceso público, registro por email/contraseña, binding D1, usuarios y siete tablas originales. No se utiliza Firebase. Se conservan las votaciones Apto / No apto, avanzada y Aguja de Oro; historial; favoritas; perfil y recuperación; clasificación popular; selección libre con guardado y descarga; y administración de agrupaciones y sesiones.

El listado aportado por el propietario se incorpora como COAC 2027: 125 filas, con 56 comparsas, 44 chirigotas, 17 coros y 8 cuartetos según la modalidad literal de la imagen. Veinte nombres parciales o dudosos se señalan para revisión, como autorizó el propietario. Se pueden corregir sin cambiar sus identificadores. Los datos de la demostración se conservan en su edición anterior; no se mezclan con los participantes actuales.

## Funciones implementadas

| Función | Comportamiento |
| --- | --- |
| La Quiniela | Pronósticos de semifinalistas, finalistas ordenadas y ganadores por modalidad; selección mediante tarjetas de texto; guardado automático; límites y fechas configurables; cierre validado en servidor; exportación PNG. |
| Resultados y puntos | Publicación administrativa con fuente y confirmación; correcciones auditadas; cierre de pronósticos y recálculo de puntos. Reglas iniciales 30/60/150 y 100 adicionales por puesto exacto, editables. |
| Termómetro | Un voto previo por persona y modalidad, modificable; porcentajes y participantes; snapshots agregados y gráfica de evolución; cierre por plazo o comienzo del concurso. |
| Semáforo | Excelente, Buena, Regular y Mala; umbrales y muestra mínima configurables; usa puntuación avanzada normalizada o porcentaje de aptos; muestra insuficiente señalada sin atribuir una valoración. |
| Comparador y evolución | Dos agrupaciones, autoría/dirección/fotografías documentadas, medias, votos por actuación, puesto popular, fases y resultados con fuente; series históricas, enfrentamientos comparables y PNG compartible. |
| Bingo del Falla | Cartón aleatorio 5×5 por persona y función, progreso persistente, líneas/columnas/diagonales/bingo, PNG y modo libre. Ranking competitivo calculado desde marcas y situaciones confirmadas; no recompensa casillas marcadas antes de validarse. |
| Liga VotaCOAC | Alias público, puntos, posición, aciertos, puestos exactos, logros calculados e historial por edición; clasificación general y filtro por fase con paginación; ligas privadas mediante código aleatorio renovable. |
| Mi Carnaval | Conserva votos, favoritas y ajustes, y añade historial de quinielas, puntos, posición, logros y acceso a ligas. Los votos de ediciones anteriores permanecen consultables. |
| Administración | Activación de módulos, ventanas UTC, límites y puntos, situaciones y validaciones del bingo, fuentes/correcciones de resultados, auditoría antes/después, moderación sin borrar registros, precios/plantilla/presupuesto Fantasy y claves revocables. |
| Fantasy | API de lectura v1 con manifest, snapshot y cambios incrementales; IDs estables, claves de servidor almacenadas como hash, reintentos/idempotencia documentados y exportación exclusiva de datos del concurso y agregados. Conexión externa desactivada por petición del propietario. |

## Datos y migraciones

Antes de preparar la migración se guardó una copia privada de las siete tablas de producción mediante las herramientas del alojamiento, sin truncamientos. La copia queda fuera del repositorio y de los recursos publicados.

- `drizzle/0001_solid_newton_destine.sql`: añade 18 tablas. Total posterior: 25 tablas de aplicación.
- `drizzle/0002_dazzling_songbird.sql`: añade índices de votos por edición/actuación y edición/modalidad/tipo.
- La migración inicial ya aplicada y sus metadatos permanecen intactos.
- No hay borrado ni reconstrucción de las tablas originales, ni cambios de esquema durante peticiones.
- Las migraciones se aplican en Sites antes de activar el Worker de esta versión. También se han aplicado en SQLite aislado para comprobar compatibilidad y conservación de registros poblados.

Las nuevas tablas cubren configuración, ediciones, pronósticos, resultados, publicaciones, puntos, perfiles, ligas, apoyos e históricos, cartones y confirmaciones del bingo, snapshots de métricas, eventos incrementales, claves, auditoría y moderación. Se mantienen los datos individuales privados y se calculan las puntuaciones en servidor.

Los agregados públicos usan una caché de cinco segundos por instancia, invalidada tras cambios relevantes; los datos de cuenta, sesiones y registros individuales no entran en esa caché. Las consultas de una actuación se acotan a su identificador y las listas grandes tienen límites o paginación. No se ha realizado una prueba de carga masiva; no se atribuye una capacidad de concurrencia no medida.

## Verificación ejecutada

- `npm run typecheck`: correcto.
- `npm run test:server`: 21 pruebas correctas; 9 de regresión y 12 de ampliación.
- Prueba de migración sobre tablas originales pobladas: usuarios, votos, favoritas y selección anterior se conservan sin cambios.
- Pruebas de plazos, selecciones inválidas, puntos enviados por el navegador ignorados, resultados/correcciones y auditoría.
- Pruebas de voto previo único y modificable, cierres y privacidad de agregados; una prueba adicional fuerza un cierre concurrente mientras la escritura está pendiente y verifica que la base de datos rechaza el voto.
- Pruebas de ligas privadas, invitaciones, acceso de terceros y renovación de códigos.
- Pruebas de bingo persistente, marcas ajenas/incorrectas, líneas y protección frente a marcar por adelantado.
- Pruebas de muestra mínima del semáforo y de históricos sin inventar fases ni rellenar medias con cero.
- Pruebas de moderación, módulos desactivados y autenticación/revocación/repetición incremental de la API de integración.
- Comprobación de renderizado de las 125 tarjetas solo de texto, portada, menús, nuevas vistas y perfil/administración existentes.
- `npm run build`: correcto, con recursos estáticos y servidor agrupados en el Worker de producción.

La comprobación en navegador real, las interacciones táctiles y la revisión visual de los PNG quedan pendientes: este entorno no ofrece la infraestructura de navegador de Sites. La compilación y el renderizado no sustituyen esas comprobaciones.

## Datos y configuración pendientes

1. **Calendario y fases reales:** no estaban documentados en la imagen. Las agrupaciones sin actuación programada se muestran como pendientes. No se han creado funciones ni horarios ficticios. El bingo libre y el termómetro previo están disponibles; el bingo por función y la votación del repertorio utilizan el calendario cuando se configure.
2. **Fechas de cierre:** administración debe fijar los plazos reales para abrir cada quiniela. Sin una fecha de cierre configurada, la fase permanece cerrada. Publicar resultados también bloquea nuevas predicciones.
3. **Resultados oficiales:** ninguno se ha precargado. Rankings, puntos, semáforos y curvas se alimentan de participaciones y resultados guardados; sus estados vacíos son deliberados cuando no hay datos.
4. **Nombres y documentación:** revisar veinte nombres señalados y los campos de autoría/localidad no legibles. La fila «¡Vámonos de frente!» mantiene la modalidad Comparsa escrita en la fuente, con una nota administrativa sobre su ubicación en el bloque amarillo. Fotografías y dirección solo se muestran si se añaden datos documentados.
5. **Fantasy:** no conectado, por instrucción posterior del propietario. El proyecto privado de Lovable no permitió inspeccionar su API o esquema. El consumidor, fichajes, equipos, capitán, ventanas de transferencias, cálculo de puntos Fantasy y SSO pertenecen a ese proyecto independiente y no se presentan como terminados ni comprobados aquí. El contrato implementado permite preparar su futura conexión sin compartir contraseñas o bases de datos.
6. **Acceso y recuperación:** se conserva el email/contraseña existente. No hay verificación del email ni proveedor de correo; la recuperación usa el código personal entregado al registrarse. Los límites por cuenta/IP, las restricciones únicas y la moderación reducen abuso; no se atribuye una garantía absoluta contra cuentas automatizadas.

Contrato técnico de Fantasy: [fantasy-api.md](fantasy-api.md).

## Archivos modificados o añadidos

- `README.md`
- `db/schema.ts`
- `docs/ampliacion-2027.md`
- `docs/fantasy-api.md`
- `drizzle/0001_solid_newton_destine.sql`
- `drizzle/0002_dazzling_songbird.sql`
- `drizzle/meta/0001_snapshot.json`
- `drizzle/meta/0002_snapshot.json`
- `drizzle/meta/_journal.json`
- `package.json`
- `public/docs/ampliacion-2027.md`
- `public/docs/fantasy-api.md`
- `scripts/build-server.mjs`
- `server/app.mjs`
- `server/competition-core.mjs`
- `server/competition.mjs`
- `server/http.mjs`
- `server/public-cache.mjs`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/admin-view.tsx`
- `src/components/app-provider.tsx`
- `src/components/bingo-view.tsx`
- `src/components/community-profile.tsx`
- `src/components/competition-ui.tsx`
- `src/components/fantasy-view.tsx`
- `src/components/forecast-view.tsx`
- `src/components/group-card.tsx`
- `src/components/league-view.tsx`
- `src/components/page-header.tsx`
- `src/components/participation-admin.tsx`
- `src/components/personal-view.tsx`
- `src/components/statistics-view.tsx`
- `src/components/support-view.tsx`
- `src/hooks/use-competition.ts`
- `src/lib/api.ts`
- `src/lib/catalogue-2027.json`
- `src/lib/catalogue-review.json`
- `src/lib/competition-defaults.json`
- `src/lib/competition.ts`
- `src/lib/share-image.ts`
- `src/lib/types.ts`
- `tests/competition.test.mjs`
- `tests/helpers.mjs`
- `tests/server.test.mjs`
