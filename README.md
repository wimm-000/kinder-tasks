# Kinder Tasks

PWA familiar para organizar tareas, pagas y ahorro con perfiles separados para adultos y menores.

El alcance y las decisiones de arquitectura están documentados en [ARCHITECTURE.md](./ARCHITECTURE.md). Los resultados de cada fase están en [docs/](./docs), incluida la [Fase 8](./docs/PHASE_8.md).

## Requisitos

- Node.js 24
- pnpm 11.22.0 mediante Corepack

## Instalación

```bash
corepack enable
pnpm install
```

## Desarrollo

Crea un `.env` a partir de `.env.example`. En desarrollo son suficientes los valores predeterminados; nunca deben reutilizarse en producción.

Aplica la migración y carga el usuario de ejemplo:

```bash
pnpm db:migrate
pnpm db:seed
```

```bash
pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Calidad

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
```

La primera ejecución E2E puede requerir instalar Chromium:

```bash
pnpm exec playwright install chromium
```

## PWA

Los iconos se generan desde `public/app-icon.svg`:

```bash
pnpm generate:pwa-assets
```

El build genera el manifiesto, `sw.js` y los recursos precacheados dentro de `build/client`.

## Netlify

El proyecto utiliza la integración oficial `@netlify/vite-plugin-react-router` con React Router 7 en framework mode. `netlify.toml` configura el build, el directorio publicado y las cabeceras de seguridad iniciales.

Variables requeridas en producción:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BETTER_AUTH_SECRET`, aleatorio y con un mínimo de 32 caracteres
- `APP_URL`, con la URL HTTPS canónica
- `EMAIL_PROVIDER`
- `SUPERADMIN_EMAILS`, lista separada por comas de cuentas verificadas que pueden recibir el rol global

Las migraciones se aplican explícitamente con `pnpm db:migrate` antes del despliegue. No se ejecutan durante cada arranque serverless.

Netlify ejecuta diariamente `process-retention` para aplicar los periodos documentados. `SUPERADMIN_EMAILS` solo promociona cuentas activas y verificadas; cada promoción queda auditada y la lista no degrada administradores existentes.

El proveedor `console` solo funciona en desarrollo y escribe enlaces sensibles en la consola local. Producción permanecerá bloqueada hasta conectar un proveedor transaccional a la interfaz `EmailService`.
