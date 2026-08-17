# Fase 6: tareas y recompensas

## Objetivo

Permitir que los adultos creen y asignen tareas, que los menores soliciten su revisión y que una aprobación genere exactamente una recompensa.

## Alcance implementado

- Tareas puntuales, recurrentes y abiertas.
- Asignación independiente a varios perfiles infantiles.
- Edición de contenido, recurrencia, recompensa y asignaciones.
- Archivado seguro sin eliminar solicitudes ni recompensas históricas.
- Disponibilidad derivada por día, semana, mes u ocurrencia única.
- Límites de realizaciones para tareas abiertas.
- Solicitudes infantiles protegidas por sesión, origen y CSRF.
- Deduplicación mediante `client_request_id` y ocurrencia estable.
- Aprobación o rechazo adulto limitado por familia.
- Recompensa y aprobación dentro de una sola transacción.
- Clave económica idempotente `task-reward:{requestId}`.
- Historial infantil de solicitudes revisadas y pendientes.

## Migración

`drizzle/migrations/0004_tranquil_ma_gnuci.sql` añade `tasks`, `task_assignments` y `task_completion_requests` con claves compuestas por familia.

## Datos de desarrollo

Leo tiene asignada la tarea abierta "Bajar el reciclaje", con recompensa de 1,50 EUR y límite de tres realizaciones semanales.

## Verificación manual

1. Entrar como Paula y abrir Familia Robles > Tareas.
2. Crear una tarea puntual asignada a Leo y Nora.
3. Crear una tarea recurrente y una abierta con límite.
4. Activar el modo infantil y entrar como Leo con PIN `2468`.
5. Abrir Mis tareas y enviar una finalización.
6. Comprobar que desaparece cuando alcanza su límite del periodo.
7. Volver al acceso adulto y abrir Solicitudes pendientes.
8. Aprobar una solicitud y comprobar un único movimiento de recompensa.
9. Repetir la aprobación y confirmar que no aparece otro movimiento.
10. Rechazar otra solicitud y comprobar que no modifica el saldo.

## Pendiente para la Fase 7

- Persistencia offline opt-in.
- Cola IndexedDB de solicitudes.
- Sincronización y reintentos idempotentes.
- Limpieza y migración de cachés locales.
