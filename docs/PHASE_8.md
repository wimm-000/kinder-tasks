# Fase 8: administración, privacidad y endurecimiento

## Objetivo

Cerrar el alcance operativo con administración global aislada, derechos de exportación y eliminación, retención automatizada y cabeceras de seguridad aptas para producción.

## Alcance implementado

- Bootstrap idempotente de superadministradores mediante `SUPERADMIN_EMAILS`.
- Guard server-only `requireSuperadmin` con denegaciones auditadas.
- Panel `/admin` con búsqueda de usuarios y familias, auditoría reciente y acciones reforzadas.
- Bloqueo adulto con revocación de sesiones y desactivación familiar con revocación infantil.
- Exportación JSON familiar sin contraseñas, PIN, tokens, secretos CSRF ni direcciones IP.
- Eliminación de cuenta y familia con contraseña, confirmación textual y 30 días de recuperación.
- Endpoint nativo de hard-delete de Better Auth desactivado.
- Token de recuperación de cuenta aleatorio, almacenado exclusivamente como hash y de un solo uso.
- Purgado familiar después del periodo de gracia y anonimización de cuentas adultas vencidas.
- Retención diaria de invitaciones, sesiones, rate limits, verificaciones, tokens y auditoría.
- CSP por respuesta con nonce, HSTS, protección de framing y `no-store` en rutas autenticadas.
- Auditoría con identificadores de petición e IP seudonimizada mediante HMAC.

## Operación

1. Configurar `SUPERADMIN_EMAILS` con correos normalizados y separados por comas.
2. Aplicar `pnpm db:migrate` antes de desplegar la versión.
3. Confirmar en Netlify que `process-retention` está programada a las `03:17 UTC`.
4. Mantener `BETTER_AUTH_SECRET` estable; también protege la seudonimización de IP.
5. Configurar `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` y `EMAIL_FROM`; la recuperación depende del correo.

El job de retención es idempotente. Los triggers del ledger solo permiten eliminar movimientos y ejecuciones cuando la familia está `pending_deletion`, tiene `purge_after` vencido y el borrado ocurre dentro de la secuencia de purgado.

## Retención

- Cuenta o familia: recuperación durante 30 días.
- Sesiones infantiles revocadas o vencidas: 30 días.
- Invitaciones expiradas o revocadas: 90 días.
- Rate limits y verificaciones: hasta su vencimiento; rate limits de Better Auth, 30 días.
- Auditoría minimizada: 12 meses.
- Cuenta adulta vencida: credenciales destruidas e identidad anonimizada.
- Familia vencida: datos privados y ledger purgados en orden transaccional.

## QA manual

1. Registrar y verificar un correo incluido en `SUPERADMIN_EMAILS`; abrir `/admin` y comprobar el evento `superadmin.bootstrap`.
2. Abrir `/admin` con un adulto normal y comprobar `403` y auditoría denegada.
3. Bloquear un usuario escribiendo motivo y `BLOQUEAR`; confirmar que sus sesiones dejan de funcionar.
4. Desactivar una familia escribiendo motivo y `DESACTIVAR`; confirmar que el acceso infantil queda revocado.
5. Descargar `/app/export`; revisar que contiene solo familias propias y ningún secreto.
6. Solicitar eliminación de cuenta con contraseña y `ELIMINAR`; confirmar cierre de sesión y correo de recuperación.
7. Recuperar la cuenta desde el enlace y comprobar que puede volver a iniciar sesión.
8. Solicitar eliminación desde la privacidad familiar; comprobar que queda inaccesible y que la misma URL permite recuperarla.
9. Inspeccionar una respuesta HTML y comprobar CSP con nonce, HSTS y cabeceras de framing.
10. Ejecutar `runRetention` en una base de prueba vencida y comprobar purgado, anonimización y evento de auditoría.

## Verificación automatizada

- Integración de bootstrap, acceso permitido y acceso denegado de superadministración.
- Inmutabilidad del ledger fuera del purgado.
- Purgado de familia vencida.
- Destrucción de credenciales y anonimización adulta.
- Suite completa Vitest, typecheck, lint, formato y build SSR/PWA.
