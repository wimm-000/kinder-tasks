# Fase 5: libro de movimientos y pagas

## Objetivo

Incorporar un libro económico inmutable por menor, con saldo derivado, retiradas seguras y pagas periódicas idempotentes.

## Alcance implementado

- Libro append-only con triggers que rechazan actualizaciones y eliminaciones.
- Saldo calculado exclusivamente mediante `SUM(amount_cents)`.
- Abonos y cargos correctivos sin modificar movimientos anteriores.
- Retiradas validadas dentro de una transacción de escritura para impedir saldo negativo.
- Historial adulto e infantil limitado por la familia o sesión autorizada.
- Pagas semanales y mensuales en EUR.
- Día 29, 30 o 31 ajustado al último día válido sin deriva en meses posteriores.
- Ejecuciones y movimientos con claves idempotentes estables.
- Procesador por lotes con presupuesto temporal y función programada de Netlify.

## Migración

`drizzle/migrations/0003_tired_longshot.sql` añade `allowance_schedules`, `allowance_runs` y `money_transactions`, además de los triggers de inmutabilidad.

## Datos de desarrollo

- Leo comienza con 32,50 EUR y una retirada de 8 EUR, saldo 24,50 EUR.
- Nora tiene una paga mensual de 5 EUR configurada para el día 1.

## Verificación manual

1. Ejecutar `pnpm db:migrate` y `pnpm db:seed`.
2. Abrir Leo > Saldo e historial y comprobar 24,50 EUR.
3. Registrar un ajuste y una retirada válida.
4. Intentar retirar más del saldo y comprobar el rechazo.
5. Configurar una paga con día 31.
6. Entrar en modo infantil y comprobar saldo e historial sin IDs en la URL.

## Pendiente para la Fase 6

- Tareas puntuales, recurrentes y abiertas.
- Asignaciones múltiples.
- Solicitudes, aprobación y rechazo.
- Recompensa atómica e idempotente.
