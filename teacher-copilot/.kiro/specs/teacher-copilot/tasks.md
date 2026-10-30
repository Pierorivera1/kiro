# Tareas de implementación del copiloto docente

Checklist de implementación local, no evidencia de ejecución dentro de Kiro. Kit oficial pendiente. Las tareas de producto completadas no implican despliegue ni QA de navegador de esta versión.

## Implementado

- [x] Handler compartido local/Lambda, validación acotada, errores coherentes, HTML directo y equipo configurable T084.
- [x] Items opacos, scans paginados/clasificación reciente y jobs persistidos con finalización diferida a los dos segundos.
- [x] Adaptadores SQLite/DynamoDB; sesiones editables, guardado/lectura/lista y evidencia de texto vinculada.
- [x] Generación con Converse y demo explícito; JSON independiente validado, errores/reintentos acotados y sin fallback silencioso.
- [x] Cuatro vistas en español, fuentes identificadas, orientación sin datos personales, estados vacíos/carga/error y borradores locales.
- [x] Organizar el sílabo con el proveedor configurado; editar título, objetivo y fuente de módulos; confirmar antes de preparar.
- [x] Enviar `customModule` y `courseName` a generación y conservar fuente/nombre del curso en la sesión persistida; curso completo solo local.
- [x] Generar y editar rúbrica; guardarla con la sesión y recuperarla desde el portafolio.
- [x] Mejorar solo el texto del momento elegido conservando los otros textos y todos los tiempos.
- [x] Adaptar el borrador actual con los tres presets (sin internet, multigrado, pocos materiales) conservando los tiempos.
- [x] Imprimir/exportar por diálogo PDF del navegador la ficha completa en texto, con ediciones actuales y rúbrica.
- [x] Pruebas automatizadas locales: 28 Python, 16 Node y sintaxis JS aprobadas; llamadas Converse simuladas y preservación de borradores. Suite HTTP con permiso de loopback; no acredita Bedrock real.
- [x] Plantilla SAM, manifiestos, CANVAS/RETOS provisionales, steering y candidatos de hooks actuales/legacy.
- [x] Registrar RED inicial de módulo ausente y RED posterior de assets HTML sin presentarlos como assertions verdes.

## Evidencia y publicación pendientes

- [ ] QA de navegador de las cinco funciones nuevas: recorrido integrado, rúbrica al reabrir, impresión completa, móvil y teclado.
- [ ] Validar sílabo, rúbrica, mejora y adaptación con Bedrock real y modelo/IAM de la cuenta autorizada; mocks no son prueba cloud.
- [ ] Revalidar la plantilla actual antes del despliegue. Evidencia histórica local del 30/10/2026: SAM 1.171.0/cfn-lint 1.59.0, `sam validate --lint` aprobado; no prueba despliegue ni funciones actuales.
- [ ] Publicar/desplegar esta versión autorizada, conservar TeamId=T084 y verificar contratos públicos, persistencia y done <12s.
- [ ] Recibir el kit oficial y reconciliar CANVAS, RETOS y requisitos exactos de entrega.
- [ ] Ejecutar el hook pertinente en Kiro instalado y registrar salida real. Legacy deshabilitado/no ejecutado; no atribuir crédito a pruebas manuales.
- [ ] Registrar URL final, recorrido de presentación y evidencia evaluable de esta versión.

## Revisión

El cambio integral supera un presupuesto de 400 líneas de revisión. Revisar por comportamiento: almacenamiento/contratos → generación/herramientas → navegador → infraestructura/documentación, manteniendo pruebas y documentación junto al comportamiento. Este checklist no realiza ni acredita commit, push, PR o despliegue; la autorización operativa vigente se verifica aparte.
