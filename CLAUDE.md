# VotaCOAC 2027

Objetivo de diseño: web profesional de carnaval, expresiva y pulida, con animaciones sutiles y excelente móvil. Azul principal #3B84FA; fondos claros y acentos amarillo/fucsia/verde/naranja. Tarjetas de agrupaciones cuadradas y SOLO TEXTO.

## Trabajar con poco contexto

Empieza por src/app/globals.css, src/app/page.tsx, src/components/page-header.tsx, src/components/group-card.tsx y tailwind.config.ts. Lee otros componentes únicamente cuando sean necesarios. No cargues catálogos, package-lock.json o todas las pruebas para una tarea visual. Implementa cambios en archivos; explica brevemente lo realizado.

## Arquitectura y límites

Next.js 15, React 19, Tailwind, Radix y Framer Motion ya instalados. Reutiliza sus componentes y dependencias. Conserva autenticación, APIs, permisos, usuarios, votaciones y todos los módulos. No uses Firebase. Fantasy está preparado pero desconectado.

next dev sirve la interfaz; las APIs están en el Worker de server/ y requieren Cloudflare D1. No sustituyas servicios por simulaciones. Las contraseñas y datos reales del alojamiento no están en este repositorio.

Node.js 24. npm ci; npm run typecheck; npm run test:server; npm run build.

Las migraciones ya aplicadas son inmutables. Un rediseño no requiere cambiarlas. La identidad de alojamiento se conserva en .openai/hosting.json.
