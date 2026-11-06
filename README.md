# VotaCOAC · COAC 2027

Plataforma pública independiente para seguir el Carnaval de Cádiz. Amplía la misma aplicación Next.js/React y Worker con Cloudflare D1. No utiliza Firebase.

## Catálogo y funcionamiento

La edición activa utiliza las 125 filas del listado aportado y confirmado por el propietario como COAC 2027: 56 comparsas, 44 chirigotas, 17 coros y 8 cuartetos, respetando la modalidad literal indicada. Veinte nombres parciales o de lectura dudosa llevan `needsReview`; pueden corregirse desde administración conservando sus IDs. La fila «¡Vámonos de frente!» conserva Comparsa, que es la modalidad escrita en la imagen aunque aparezca en el bloque amarillo.

No se ha inventado calendario, fotografía, dirección ni resultado oficial. Las agrupaciones sin actuación programada se pueden guardar como favoritas y elegir en el termómetro previo; su votación de repertorio se abre al publicar una actuación con fecha de apertura. Las ocho agrupaciones ficticias y sus sesiones se conservan como catálogo de la edición de demostración, separado de la edición activa. Ningún usuario ni registro previo se elimina por este cambio.

Siguen disponibles el registro y acceso con email/contraseña, recuperación mediante código, perfil, cambio de contraseña, eliminación de cuenta, favoritas, historial, votación Apto / No apto, puntuación avanzada recalculada por el servidor, Aguja de Oro, clasificaciones y selección libre con guardado y descarga de texto.

## Nuevos módulos

- **La Quiniela:** pronósticos ordenados por modalidad para semifinales, final y ganadores; guardado automático, plazos y límites configurables, cierre en el servidor, resultados documentados, recálculo de puntos y exportación PNG.
- **Termómetro:** un apoyo por cuenta y modalidad, modificable hasta el cierre o el inicio del concurso; porcentajes, participantes, historial agregado por hora y comparación con las votaciones del repertorio.
- **Semáforo:** puntuación normalizada o porcentaje de aptos, con umbrales y muestra mínima configurables. Sin muestra suficiente no atribuye un color valorativo.
- **Comparador y evolución:** autoría/dirección/fotografías documentadas, medias, votos por actuación, posiciones, fases, resultados con fuente, series históricas, enfrentamientos comparables y exportación PNG. Los datos ausentes no se rellenan con resultados ficticios.
- **Bingo del Falla:** cartones aleatorios 5×5 persistentes por persona y función; líneas, columnas, diagonales, bingo y exportación PNG; modo libre fuera de clasificación. Los puntos competitivos se calculan en el servidor con situaciones confirmadas antes de marcar. Marcar por adelantado no otorga futuros puntos.
- **Liga VotaCOAC:** puntos, aciertos, puestos, alias público, logros calculados, clasificación por edición y fase, paginación y ligas privadas con invitaciones aleatorias renovables. El historial personal conserva otras ediciones.
- **Fantasy:** información y contrato de integración, presupuesto/plantilla/precios configurables, claves de servidor revocables y sincronización incremental. La conexión externa permanece desactivada por instrucción del propietario.

## Administración

Activar la cuenta reservada `carnavalinense@gmail.com` mediante verificación del propietario del alojamiento. Después utiliza email y contraseña. El panel conserva la gestión de agrupaciones, sesiones y usuarios y añade Participación y juegos: módulos, fechas UTC, límites, reglas, fuentes y correcciones de resultados, auditoría, moderación, situaciones y validación de bingo, precios Fantasy y claves de integración. No es necesario editar código para esas operaciones.

Antes de abrir las quinielas deben configurarse fechas de cierre reales. Añadir el calendario y las fases a las sesiones para habilitar votaciones de actuaciones y bingo de cada función. La ausencia de fechas oficiales deja esas operaciones pendientes; el termómetro previo, las favoritas, la selección libre, las ligas y el bingo libre pueden utilizarse con las funciones correspondientes activas.

No hay proveedor de correo configurado. Cada alta entrega un código de recuperación una sola vez; cambiar la contraseña mediante ese código rota el código y cierra sesiones. Guardarlo en un lugar seguro.

## Datos, seguridad y migraciones

El esquema Drizzle añade 18 tablas a las 7 existentes mediante `0001_solid_newton_destine.sql`; `0002_dazzling_songbird.sql` añade índices a las consultas de votos. La migración no modifica ni elimina las tablas originales. Se conservó una copia privada de las tablas de producción antes de preparar la migración; no se incorpora al repositorio ni a los recursos públicos.

Contraseñas PBKDF2-SHA256 con sal aleatoria; sesiones y códigos guardados como hashes; cookie HttpOnly, Secure, SameSite=Lax; origen propio y cabecera de aplicación en escrituras; límites por usuario/IP; restricciones únicas; permisos de usuario y administrador; recálculo de puntuaciones en servidor; operaciones administrativas auditadas. Los datos públicos son agregados y las clasificaciones de juegos usan alias. La moderación excluye aportaciones suspendidas sin borrar sus registros.

Los agregados públicos tienen una caché de cinco segundos por instancia, invalidada al votar, moderar, eliminar una cuenta o actualizar el catálogo; las cuentas y registros personales nunca se almacenan en esa caché. Las consultas de snapshots de una actuación están acotadas a esa actuación.

Los snapshots de métricas y apoyo agregado son históricos independientes de cambios posteriores. Los puntos se recalculan a partir de pronósticos y resultados guardados, nunca desde puntos enviados por el navegador.

## Fantasy COAC

Contrato y protocolo en [docs/fantasy-api.md](docs/fantasy-api.md). El enlace privado de Lovable no ofrece una API inspeccionable en este entorno. No se han activado sincronización, webhooks, SSO, fichajes ni equipos dentro de VotaCOAC: pertenecen al proyecto independiente. La API implementada exporta únicamente datos del concurso y valoraciones agregadas. Requiere validar el consumidor real antes de una futura conexión de producción.

## Desarrollo

Node.js 24:

```sh
npm ci
npm run typecheck
npm run test:server
npm run build
```

`npm run dev` sirve la interfaz; las rutas `/api/` pertenecen al Worker y requieren D1. Las pruebas utilizan SQLite aislado, aplican las mismas migraciones y simulan el contrato D1. El build conserva Next estático en `out/` y lo integra con el servidor en `dist/server/index.js`. `.openai/hosting.json` mantiene el proyecto y el binding lógico DB. La publicación en Sites aplica las migraciones antes del nuevo Worker.

La revisión visual y las descargas PNG en un navegador real quedan pendientes porque no hay infraestructura de navegador/preview disponible en este entorno. Se verifican tipos, compilación, renderizado y operaciones del servidor.
