# Fase 2: persistencia y autenticación adulta

## Objetivo

Incorporar una base de datos Turso/LibSQL y completar la autenticación adulta antes de crear familias. Better Auth es el único responsable de credenciales, tokens y sesiones; Drizzle gestiona el esquema y las migraciones.

## Alcance implementado

- Conexión server-only a Turso mediante `@libsql/client` y Drizzle.
- Entorno validado con Zod y valores locales seguros para desarrollo.
- Registro con nombre, correo, contraseña y aceptación legal.
- Verificación obligatoria de correo.
- Inicio y cierre de sesión persistentes.
- Recuperación y restablecimiento de contraseña.
- Revocación de sesiones tras restablecer una contraseña.
- Edición del nombre del perfil adulto.
- Cambio de contraseña con revocación de otras sesiones.
- Lista y revocación de sesiones activas.
- Eliminación reforzada de cuenta mediante contraseña y texto de confirmación.
- Rate limiting persistido para registro, login, recuperación y verificación.
- Protección server-side de `/app` y de los endpoints privados de Better Auth.
- UUIDv7 para usuarios, cuentas, sesiones, verificaciones y rate limits.
- Servicio de correo abstraído con adaptadores de consola y memoria.
- Seed local realista y pruebas de integración contra LibSQL.

## Modelo de datos

La migración `drizzle/migrations/0000_thin_paladin.sql` crea:

- `user`: identidad adulta y estado de verificación.
- `session`: sesiones revocables, expiración, agente e IP.
- `account`: proveedor `credential` y hash scrypt de contraseña.
- `verification`: tokens temporales de correo y recuperación.
- `rate_limit`: contadores persistentes para entornos serverless.
- `user_profiles`: rol global, estado operativo y locale.

Relaciones y borrado:

- `session.user_id -> user.id ON DELETE CASCADE`.
- `account.user_id -> user.id ON DELETE CASCADE`.
- `user_profiles.user_id -> user.id ON DELETE CASCADE`.
- El email, token de sesión y combinación proveedor/cuenta tienen índices únicos.
- `user_profiles.global_role` y `user_profiles.status` tienen restricciones `CHECK`.

Las tablas familiares se añadirán junto a sus casos de uso en la Fase 3. No se exponen consultas Drizzle al navegador.

## Seguridad

- Contraseñas de 12 a 128 caracteres, hasheadas por Better Auth mediante scrypt.
- Cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Verificación de origen y CSRF proporcionadas por Better Auth.
- Origen adicional `127.0.0.1` permitido únicamente en desarrollo para Playwright.
- Sesión de 30 días, rotación diaria y frescura de 30 minutos.
- Recuperación válida durante 30 minutos y verificación durante una hora.
- La recuperación revoca todas las sesiones previas.
- Account linking desactivado en el MVP.
- Roles y estados proceden exclusivamente de `user_profiles`.
- Cuentas bloqueadas no pueden crear sesiones ni usar endpoints privados con cookies antiguas.
- Redirecciones posteriores al login solo aceptan rutas locales.
- Las respuestas de recuperación no confirman si el correo existe.

## Rate limiting

- Registro: 5 intentos por hora e IP.
- Login: 5 intentos por minuto e IP.
- Recuperación: 3 intentos cada 15 minutos e IP.
- Reenvío de verificación: 3 intentos cada 15 minutos e IP.
- Límite general: 100 peticiones por minuto.

Los contadores se guardan en Turso y no dependen de la memoria de una función serverless.

## Correo

La interfaz `EmailService` desacopla Better Auth del proveedor final.

En desarrollo, `ConsoleEmailService` muestra el enlace completo en la consola para poder verificar y recuperar cuentas sin proveedor externo. Este adaptador rechaza envíos en producción para impedir que tokens sensibles terminen en logs reales.

La Fase 8 añadió `ResendEmailService`. En producción se configura con `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` y `EMAIL_FROM`; el adaptador de consola continúa bloqueado fuera de desarrollo.

## Datos de ejemplo

`pnpm db:seed` crea o reutiliza:

- Nombre: Paula Robles.
- Correo: `paula.robles@example.test`.
- Contraseña: `FamiliaRobles2026!`.
- Correo marcado como verificado.
- Perfil global con rol `user`, estado `active` y locale `es`.

El seed se niega a ejecutarse cuando `NODE_ENV=production`.

## Pruebas

Pruebas unitarias:

- Contraseñas coincidentes y aceptación legal.
- Rechazo de redirecciones externas.
- Componentes y traducciones de la Fase 1.

Pruebas de integración con base efímera:

- Registro real mediante el handler Better Auth.
- Generación del correo de verificación.
- Verificación y creación de sesión segura.
- Creación automática de `user_profiles`.
- Recuperación y restablecimiento real.
- Revocación de la sesión anterior.
- Login con la contraseña nueva.
- Rate limiting después de intentos fallidos.
- Bloqueo de mutaciones para un perfil desactivado.
- Lista y revocación de sesiones.

Pruebas E2E en Chromium desktop y móvil:

- Redirección desde una ruta adulta protegida.
- Login de un padre verificado.
- Validación accesible del registro.
- Confirmación anti-enumeración de recuperación.
- Flujos públicos de la Fase 1.

## Verificación manual

1. Ejecutar `pnpm db:migrate`.
2. Ejecutar `pnpm db:seed`.
3. Iniciar la aplicación con `pnpm dev`.
4. Acceder con el usuario de seed.
5. Abrir Perfil y modificar el nombre.
6. Abrir Seguridad y comprobar la sesión actual.
7. Registrar un correo nuevo.
8. Copiar desde la consola el enlace `development_email` y abrirlo.
9. Cerrar sesión e iniciar con la cuenta verificada.
10. Solicitar recuperación y abrir el enlace mostrado en consola.
11. Comprobar que la contraseña anterior deja de funcionar.

## Comandos de calidad

```bash
pnpm db:migrate
pnpm db:seed
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
pnpm peers check
```

## Pendiente para la Fase 3

- Familias.
- Membresías adultas.
- Selector de familia.
- Autorización por `family_id`.
- Invitaciones verificadas a otros padres.
- Auditoría familiar inicial.
