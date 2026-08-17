# Fase 3: familias, membresías e invitaciones

## Objetivo

Convertir cada familia en una frontera de autorización independiente y permitir que varios adultos compartan su gestión mediante invitaciones verificadas.

## Alcance implementado

- Creación atómica de familia y membresía del adulto creador.
- Selector para cuentas con varias familias y redirección directa cuando solo existe una.
- Dashboard, miembros e invitaciones limitados por una membresía adulta activa.
- Invitaciones de siete días con token aleatorio; la base solo conserva su hash SHA-256.
- Aceptación exclusiva por una cuenta autenticada cuyo correo coincida con el invitado.
- Revocación de invitaciones pendientes.
- Auditoría append-only inicial para creación de familia y ciclo de invitaciones.
- Protección de origen en todas las actions familiares.
- Seed con `Familia Robles` y Paula como miembro adulto.

## Modelo de datos

La migración `drizzle/migrations/0001_exotic_vampiro.sql` añade `families`, `family_members`, `family_invitations` y `audit_logs`. Las membresías son únicas por familia y usuario; las invitaciones pendientes son únicas por familia y correo.

## Aislamiento

Los IDs de URL se consideran entradas no confiables. Cada lectura y mutación familiar combina el usuario de la sesión con `family_id`, rol `parent`, membresía `active` y familia `active`. Una ausencia y un acceso horizontal producen la misma respuesta 404.

## Verificación manual

1. Ejecutar `pnpm db:migrate` y `pnpm db:seed`.
2. Entrar como `paula.robles@example.test` con `FamiliaRobles2026!`.
3. Abrir Familia Robles, revisar miembros y enviar una invitación.
4. Copiar de la consola el enlace de desarrollo.
5. Entrar con una cuenta verificada que use el correo invitado y aceptar.
6. Comprobar que la nueva persona aparece entre los miembros.

## Pendiente para la Fase 4

- Perfiles infantiles.
- PIN con Argon2id.
- Dispositivos autorizados y sesiones infantiles.
- Bloqueos, restablecimiento y revocación.
