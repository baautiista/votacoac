# Las cinco del público y bingo personal

La quiniela y la selección del público comparten una única pantalla, disponible en `#pronosticos`. Los enlaces antiguos `#termometro` y `#quiniela` llevan a ella.

Cada participante guarda exactamente cinco agrupaciones de cada modalidad: veinte en total, sin puntuación por el orden. El listado público muestra las cinco más elegidas por modalidad y el porcentaje de quinielas que incluye cada agrupación. Los invitados pueden preparar un borrador; se necesita una cuenta de email y contraseña para guardarlo y consultar los aciertos. Los datos personales y las elecciones individuales no aparecen en la respuesta pública.

En Administración → Competición → Plazos y reglas se puede abrir o cerrar la quiniela y fijar sus fechas. Inicialmente no tiene fecha de cierre inventada: permanece abierta hasta desactivarla o publicar resultados. En Resultados, la opción «Las cinco del público» exige exactamente cinco agrupaciones por modalidad, puestos del 1 al 5, fuente y confirmación. Debe documentarse la clasificación de las cinco que más lejos llegaron, incluida la quinta, aunque no todas hayan sido finalistas. Publicar cualquier modalidad bloquea nuevos cambios de la quiniela. Las correcciones recalculan los aciertos y puntos sin reabrirla. Cada acierto vale inicialmente un punto, configurable desde administración.

El área «Durante el concurso» muestra esta selección pública y el acceso al registro incluso mientras las herramientas en directo siguen pendientes de activación.

## Bingo personal

Cada usuario escribe diez situaciones distintas de entre 3 y 130 caracteres. Puede usar las ideas de ejemplo, incluida «Cuplé a Andy y Lucas». El cartón se guarda por persona y función; el cartón libre también es persistente. Se puede editar hasta marcar o recibir la primera revisión. Desmarcar después no reabre la edición.

Administración → Competición → Bingo muestra los cartones y permite validar, rechazar o dejar pendiente cada casilla con su motivo. La revisión corresponde al identificador y texto exactos de la casilla. Las escrituras concurrentes no sobrescriben revisiones ni cambios de otro dispositivo. Una casilla marcada por el usuario solo cuenta al estar aprobada. Las correcciones se reflejan en la clasificación de inmediato. Cada casilla cuenta un punto, cada fila de cinco añade cinco y el bingo añade cincuenta: máximo setenta puntos por cartón de diez. El modo libre no tiene clasificación competitiva.

Los cartones antiguos de veinticinco casillas conservan sus textos y progreso y siguen usando sus eventos de validación anteriores. No se borran cuentas, votos, favoritos, quinielas antiguas ni registros del bingo. Se reutilizan las tablas existentes y no hay migraciones ni Firebase.

## Fantasy COAC

La página pública presenta únicamente «Próximamente». No enlaza una aplicación externa ni anuncia una conexión activa. Se conservan los preparativos de la API para una integración futura.

## Rutas

- `GET /api/competition/top-five`: agregados públicos, estado de apertura y selección/aciertos solo de la cuenta autenticada.
- `PUT /api/competition/forecast` con `phase: "top5"`: guarda veinte elecciones validadas por el servidor.
- `POST /api/competition/bingo` con `cells`: crea diez casillas personalizadas.
- `PATCH /api/competition/bingo`: edita un cartón todavía desbloqueado.
- `PUT /api/competition/bingo`: guarda las marcas personales sin permitir aprobarlas.
- `GET/PUT /api/admin/bingo-cards`: cola paginada y revisión de casillas, solo para administración.

Las elecciones y revisiones se guardan en D1. El almacenamiento del navegador solo conserva borradores sin enviar. Las validaciones y la publicación de resultados requieren sesión, controles de origen y permisos; las revisiones se auditan.
