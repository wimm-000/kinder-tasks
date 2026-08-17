# Fase 1: base técnica

## Objetivo

Establecer una base compilable y desplegable para Kinder Tasks antes de incorporar autenticación o persistencia. Esta fase entrega React Router 7 en framework mode, integración con Netlify, diseño público, i18n inicial, PWA mínima y herramientas de calidad.

## Alcance implementado

- React Router 7.18.2 con SSR y plugin oficial de Netlify.
- TypeScript estricto.
- Tailwind CSS y configuración compatible con shadcn/ui.
- Sistema visual responsive en modo claro y oscuro.
- Landing pública con datos familiares realistas.
- Páginas temporales de acceso y registro.
- Aviso de privacidad y términos básicos.
- Textos de React centralizados en el catálogo español.
- Estado de conectividad accesible.
- Manifiesto PWA, iconos, service worker y fallback offline.
- ESLint, Prettier, Vitest, React Testing Library y Playwright.
- Cabeceras iniciales de seguridad para Netlify.

## Archivos principales creados o modificados

- `app/root.tsx`: documento HTML, metadatos, estilos y boundary de errores.
- `app/routes.ts`: rutas públicas de la fase.
- `app/routes/home.tsx`: landing de Kinder Tasks.
- `app/routes/coming-soon.tsx`: transición hacia la futura autenticación.
- `app/routes/privacy.tsx`: aviso inicial de privacidad.
- `app/routes/terms.tsx`: términos iniciales.
- `app/components/`: marca, conectividad, legal y botón shadcn compatible.
- `app/lib/i18n/`: catálogo español tipado.
- `app/app.css`: tokens visuales, temas y accesibilidad.
- `vite.config.ts`: Netlify y configuración PWA.
- `public/`: iconos y fallback offline.
- `eslint.config.js`: reglas TypeScript, React, hooks y accesibilidad.
- `vitest.config.ts`: pruebas unitarias y de componentes.
- `playwright.config.ts`: pruebas E2E desktop y móvil.
- `netlify.toml`: build y cabeceras.
- `components.json`: configuración de shadcn/ui.

## Migraciones

Esta fase no crea base de datos y, por tanto, no contiene migraciones. El esquema Drizzle comienza en la Fase 2.

## Datos de ejemplo

La landing utiliza ejemplos en español:

- Familia Robles.
- Saldo de Leo de 24,50 EUR.
- Tarea "Bajar el reciclaje".
- Retirada para comprar un libro.
- Dos solicitudes pendientes de aprobación.

Estos datos son estáticos y no representan persistencia real.

## Pruebas

- Botón accesible y activable.
- Cambio de estado online/offline.
- Resolución del catálogo español.
- Propuesta de valor visible en escritorio y móvil.
- Navegación al aviso de privacidad.

Comandos ejecutados:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
pnpm peers check
```

Lighthouse móvil:

- Accesibilidad: 100.
- Buenas prácticas: 100.
- SEO: 100.
- Agentic Browsing: 100.

## Verificación manual

1. Ejecutar `pnpm dev`.
2. Abrir `http://localhost:5173`.
3. Comprobar la landing a 390 px y a 1280 px de ancho.
4. Navegar a Privacidad y Términos desde el footer.
5. Abrir Registro y Entrar para comprobar las pantallas de transición.
6. Activar el modo oscuro del sistema y recargar.
7. Cambiar el navegador a offline y comprobar el indicador.
8. Ejecutar `pnpm build` y comprobar `build/client/manifest.webmanifest` y `build/client/sw.js`.

## Pendiente para la Fase 2

- Drizzle y Turso.
- Better Auth.
- Registro y autenticación reales.
- Verificación y recuperación por correo.
- Variables de entorno validadas.
- Adaptador de correo de desarrollo.
