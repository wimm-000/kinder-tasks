# Fase 4: perfiles y sesiones infantiles

## Objetivo

Separar por completo la identidad infantil de Better Auth y permitir el acceso únicamente desde dispositivos autorizados previamente por un adulto.

## Alcance implementado

- CRUD adulto de perfiles infantiles con alias, avatar y color predefinidos.
- PIN de 4 a 6 cifras hasheado con Argon2id de Node 24.
- Cambio de PIN con desbloqueo y revocación de sesiones previas.
- Activación y revocación de dispositivos por familia.
- Cierre de la sesión adulta al entregar el navegador al modo infantil.
- Selector infantil limitado a la familia autorizada.
- Sesión infantil separada con token y secreto CSRF hasheados.
- Bloqueo progresivo tras intentos fallidos y límites persistentes por dispositivo e IP hasheada.
- Invalidación inmediata al desactivar un perfil, revocar un dispositivo o desactivar una familia.
- Interfaz `/kids` independiente, sin enlaces ni operaciones adultas.

## Modelo de datos

La migración `drizzle/migrations/0002_tidy_sasquatch.sql` añade `child_profiles`, `child_credentials`, `child_device_authorizations`, `child_sessions` y `rate_limit_buckets`. Las claves foráneas compuestas impiden combinar perfiles y dispositivos de familias diferentes.

## Datos de desarrollo

- Leo: PIN `2468`.
- Nora: PIN `1357`.

Los PIN solo se documentan para el seed local; la base conserva exclusivamente hashes Argon2id.

## Verificación manual

1. Ejecutar `pnpm db:migrate` y `pnpm db:seed`.
2. Entrar como Paula y abrir Familia Robles > Perfiles infantiles.
3. Crear o editar un perfil y cambiar su PIN.
4. Activar el modo infantil para este dispositivo.
5. Comprobar que `/app` vuelve a pedir acceso adulto.
6. Elegir Leo, introducir `2468` y abrir `/kids/home`.
7. Cambiar de perfil o salir del modo infantil.

## Pendiente para la Fase 5

- Libro inmutable de movimientos.
- Saldo e historial.
- Retiradas y ajustes.
- Pagas periódicas e idempotentes.
