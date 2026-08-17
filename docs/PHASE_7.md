# Fase 7: offline y PWA completa

## Objetivo

Permitir consultas infantiles y solicitudes de finalización durante cortes de red sin guardar credenciales ni cachear respuestas autenticadas.

## Alcance implementado

- Persistencia IndexedDB versionada y desactivada por defecto.
- Consentimiento explícito por menor y dispositivo.
- Snapshot mínimo de saldo, movimientos recientes y tareas disponibles.
- Caducidad local de siete días.
- Cola idempotente de solicitudes con `client_request_id` estable.
- Estados `queued`, `syncing`, `synced`, `conflict` y `failed`.
- Endpoint `/api/kids/sync` protegido por sesión infantil, origen y CSRF.
- Sincronización al recuperar conexión, enfocar la ventana o pulsar reintentar.
- Heartbeat que elimina datos locales cuando la sesión o dispositivo se revocan.
- Limpieza completa al salir del modo infantil.
- Fallback offline limitado al perfil desbloqueado en la pestaña actual.
- Workbox restringido a recursos estáticos; no existe caché runtime para rutas autenticadas.

## Privacidad

IndexedDB nunca contiene PIN, hashes, cookies, tokens ni secretos CSRF. Los snapshots solo se escriben después del consentimiento y se separan mediante `familyId` y `childId`. Cambiar de perfil elimina la referencia activa y salir borra toda la base local.

## Sincronización

Cada finalización conserva el mismo `client_request_id` desde que se encola hasta que el servidor responde. Reenviar el lote produce la misma solicitud y nunca una recompensa duplicada. Un conflicto indica que la tarea dejó de estar disponible; los fallos de red permanecen reintentables.

## Verificación manual

1. Entrar como Paula y activar el modo infantil para Familia Robles.
2. Entrar como Leo con PIN `2468`.
3. Activar "Recordar datos en este dispositivo" y aceptar el aviso.
4. Desconectar la red desde DevTools.
5. Abrir Mis tareas y marcar una tarea como terminada.
6. Comprobar el mensaje de solicitud guardada.
7. Recuperar la red y comprobar "Todo está sincronizado".
8. Volver al área adulta y aprobar la solicitud una sola vez.
9. Desconectar de nuevo y recargar para comprobar el fallback con saldo y tareas.
10. Salir del modo infantil y comprobar que el fallback ya no muestra datos.

## Pendiente para la Fase 8

- Panel de superadministración.
- Exportación y eliminación diferida.
- Retención y purgado.
- Endurecimiento final de CSP, auditoría y observabilidad.
