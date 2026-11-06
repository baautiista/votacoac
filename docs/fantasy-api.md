# VotaCOAC → Fantasy COAC: contrato de lectura v1

Estado: implementado en VotaCOAC y probado localmente. **Conexión externa desactivada por petición del propietario.** La API, el esquema, los equipos y el cálculo de Fantasy no se han verificado. No se realiza ninguna llamada saliente a Lovable ni se comparte una sesión de usuario.

Base de producción: `https://votacoac.miguelbaulim.chatgpt.site/api/integration/v1`.

## Autenticación y alcance

Crear una clave desde Administración → Participación y juegos → Fantasy / API. Solo se muestra una vez. Guardarla en el gestor de secretos del **servidor de Fantasy** y enviar `Authorization: Bearer <clave>` en cada petición. Nunca incluirla en JavaScript público, almacenamiento del navegador, URL, Git, logs ni imágenes. La base de VotaCOAC almacena únicamente su hash SHA-256; las claves se pueden revocar. No se necesita ninguna credencial de base de datos ni un acceso directo de Fantasy a D1.

La API es de solo lectura. Se exportan datos del concurso y agregados de popularidad. No se exportan usuarios, emails, contraseñas, sesiones, pronósticos individuales, votos individuales ni miembros de ligas. No se habilita CORS para uso directo desde el navegador.

## Identificadores

- `edition.id`: edición de origen; no cambiarlo en el consumidor ni unirlo a otra edición por el nombre visible.
- `group.id`: identificador estable de VotaCOAC. Conservarlo como `source_group_id` en Fantasy, con una restricción única junto a `edition.id`.
- `performance.id`: identificador estable de una actuación. Una agrupación puede tener varias actuaciones en distintas fases.
- `session.id`: función o sesión, con `phase` cuando esté documentada.
- Los nombres, la autoría y otros textos se pueden corregir sin cambiar el identificador.
- La primera carga del listado utiliza 125 filas aportadas por el propietario. `needsReview` identifica nombres pendientes de revisión. No deducir identidad o equivalencia por parecido de nombres.

## GET /manifest

Devuelve la versión `1.0`, la edición activa, la política de privacidad, los endpoints disponibles y la configuración preparada de Fantasy: presupuesto, composición de plantilla y precios explícitamente configurados.

La composición inicial preparada es 3 comparsas, 3 chirigotas, 1 coro y 1 cuarteto, con 100 millones ficticios. Los precios sin configurar están ausentes de `prices`; **no convertirlos en cero ni inventar un precio**.

## GET /snapshot

Devuelve:

```json
{
  "version": "1.0",
  "cursor": 0,
  "generatedAt": "fecha ISO UTC",
  "edition": {"id": "coac-2027", "name": "COAC 2027", "demo": false},
  "groups": [],
  "sessions": [],
  "phases": ["preliminares", "cuartos", "semifinales", "final"],
  "officialResults": [],
  "popular": {},
  "fantasy": {"budget": 100, "roster": {"Comparsa": 3, "Chirigota": 3, "Coro": 1, "Cuarteto": 1}, "prices": {}}
}
```

Este ejemplo describe el formato, no resultados del concurso. Las colecciones vacías significan que todavía no se han publicado esos datos. `officialResults` contiene fase, modalidad, `groupId`, puesto nullable, fuente y fecha de actualización. `popular` utiliza `performance.id` como clave y contiene medias y recuentos por tipo de voto. Una media ausente es `null`, no cero.

El cursor se obtiene antes de recoger los datos: el snapshot puede incluir algún cambio posterior a ese cursor. Reproducir ese evento otra vez es seguro si el consumidor hace upsert por identificador. Esta estrategia evita perder cambios durante la carga inicial.

## GET /changes?after=<cursor>&limit=50

- `after`: entero no negativo devuelto como cursor por esta API.
- `limit`: entre 1 y 100. El valor por defecto es 50.
- Respuesta: `version`, `editionId`, `events`, `nextCursor`, `hasMore`.
- Evento: `id`, `type`, `entityId`, `data`, `occurredAt`.
- Tipos: `catalog.updated`, `popular.updated`, `support.updated`, `results.updated`, `rules.updated`.
- Los eventos se devuelven en orden ascendente y permanecen disponibles para reintentos. El cliente conserva el último cursor aplicado en una transacción con sus cambios de datos.
- Deduplicar mediante una restricción única `(source, edition_id, event_id)`. Repetir una petición o un evento no debe sumar puntos dos veces.
- `results.updated` reemplaza el conjunto completo de resultados de su fase y modalidad. No añadir puntos a ciegas: recalcular desde el estado resultante.
- `catalog.updated` reemplaza el catálogo de esa edición. Retirar una agrupación del catálogo activo no autoriza a borrar el historial de equipos en Fantasy.
- `popular.updated` reemplaza los agregados de esa actuación. Incluye correcciones debidas a moderación y eliminación de cuentas.
- `rules.updated` incluye reglas de pronóstico y configuración de plantilla, presupuesto y precios de Fantasy.
- `support.updated` reemplaza el agregado previo de la modalidad. No contiene el voto de ninguna persona.

## Protocolo recomendado del consumidor

1. Validar `/manifest` y versión soportada. Ejecutar primero en un entorno de pruebas de Fantasy.
2. Importar `/snapshot` con upserts, preservando identificadores fuente y sin borrar históricos.
3. Guardar su cursor y pedir `/changes` hasta `hasMore=false`.
4. Aplicar cada página de eventos y su nuevo cursor en la misma transacción del consumidor. Si falla un evento, no avanzar el cursor.
5. Recalcular los puntos Fantasy por resultados guardados, con las reglas reales de Fantasy. VotaCOAC no ha definido ni verificado esa fórmula.
6. Ante un fallo de red o 5xx, reintentar la misma página con espera creciente y variación aleatoria, con un máximo de cinco intentos por ciclo. Ante 429, pausar al menos un minuto. Ante 401, parar y revisar la clave; no continuar con datos antiguos como si estuvieran actualizados.
7. Supervisar cursor confirmado, último éxito, error y antigüedad de los datos en Fantasy. VotaCOAC muestra el último uso de cada clave; no lo presenta como una sincronización exitosa del consumidor.
8. Antes de activar producción, comparar ambos catálogos, aplicar el mismo evento dos veces, simular una interrupción, corregir un resultado y verificar que los puntos se recalculan sin duplicación.

Límite inicial: 180 peticiones de integración por minuto e IP. Preferir lotes y consultas periódicas; no consultar por cada visitante. No hay webhooks activos: se implementa la alternativa de sincronización incremental pedida.

## Errores

JSON: `{"error":"mensaje", "code":"código"}`. Estados relevantes: 400 datos o cursor inválidos; 401 clave ausente/revocada; 404 endpoint desconocido; 405 operación de escritura no soportada; 429 demasiadas solicitudes; 500 error interno. No se entregan stack traces ni credenciales.

## Límites de la preparación actual

No se han conectado las dos bases de datos, creado equipos en VotaCOAC, activado fichajes, ventanas de transferencias, SSO ni cálculos Fantasy. Son funciones de la aplicación independiente. La URL privada del editor de Lovable no se usa como si fuera una aplicación pública. La conexión y las pruebas de extremo a extremo requieren el código o la API real de Fantasy cuando el propietario decida continuar.
