# Diseño del copiloto docente

## Ejecución y almacenamiento

Un handler Python Lambda sirve API y recursos estáticos. `/app` entrega HTML directamente; `/app/assets` usa rutas absolutas. El servidor local traduce HTTP a eventos API Gateway v2 y ejecuta el mismo handler. SQLite persiste en `.local/copiloto.sqlite3` ignorado por Git; `TABLE_NAME` selecciona DynamoDB en AWS.

Items, jobs, sesiones y evidencias son entidades distintas. DynamoDB usa `pk=<kind>#<uuid>`, metadatos `kind`/owner y un payload JSON que evita serialización float de timestamps. Lecturas fuertes y scans paginados permiten verificar persistencia. Items clasifica hasta 100 recientes con presupuesto explícito de 10 000 registros evaluados; no es un índice de producción. Evidencias se asocian por sessionId, no por identidad autenticada.

## Flujo del sílabo a la sesión

`POST /courses/generate` envía nombre y sílabo al generador configurado y devuelve módulos validados; el servidor asigna sus ids. La UI permite editar título, objetivo y fuente, y exige confirmar antes de usar esa ruta. El curso completo permanece como borrador local; no se crea una entidad servidor de curso.

La preparación envía el módulo elegido como `customModule:{id,title,objective,text}`, además de `courseName`, grado, contexto y duración. Sin curso confirmado se usa el catálogo ficticio servidor. El generador recibe la fuente real editada. La sesión se crea durablemente como draft e incluye `module`, `moduleTitle`, `moduleId`, `courseName` y procedencia, además de los campos pedagógicos. Guardar cambia el estado a saved sin sustituir su fuente/procedencia.

## Herramientas sobre la edición actual

| Operación | Entrada y aplicación |
| --- | --- |
| Rúbrica | `{lesson}` actual → criterios y tres niveles; UI editable. `PUT /sessions/{id}` persiste la rúbrica con la sesión. |
| Mejorar momento | `{lesson,phase,instruction}` → solo texto seleccionado; la UI conserva otros textos y todos los tiempos. |
| Adaptar al aula | `{lesson,instruction}` desde Sin internet, Aula multigrado o Pocos materiales; conserva tiempos por fase y rúbrica existente. |
| Imprimir / PDF | Ficha de texto creada con el borrador actual completo, fuente y rúbrica; `window.print()` abre el diálogo del navegador. No hay servicio PDF. |

Rúbrica, mejora y adaptación son propuestas, no escrituras automáticas. La UI mantiene borradores locales y exige Guardar sesión para persistir sus cambios en servidor. Una respuesta antigua no reemplaza ediciones más recientes. Una adaptación puede requerir regenerar la rúbrica: no se promete realineación automática.

## Proveedor y confianza

`DemoGenerator` es explícito y determinista para todas las operaciones; nunca se presenta como IA real. `BedrockGenerator` usa Converse con instrucciones separadas de datos y JSON validado independientemente. Límites de salida: sesión/rúbrica 1 800 tokens, mejora 1 300, adaptación 2 200, curso 2 600; temperatura 0,3. Throttling admite tres intentos totales y backoffs 0,25/0,5 s; retries SDK desactivados. Timeouts connect/read acotan el trabajo. No se promete disponibilidad de un modelo por tener configuración.

Procedencia asignada por servidor; errores se muestran y nunca producen muestras silenciosas. El docente revisa relevancia y exactitud. No se registran entradas ni respuestas del modelo. La UI usa textContent/value y CSP restrictiva. El prototipo es compartido sin autenticación: solo datos ficticios o anónimos, no información escolar confidencial.

## Navegador y límites de validación

Cuatro vistas sin framework: Crear curso, Preparar clase, Revisar sesión, Portafolio. localStorage conserva curso, preparación, borradores por sesión y evidencias no enviadas cuando está disponible; denegación de almacenamiento se comunica. El guardado servidor es independiente del respaldo local. La ficha de impresión usa párrafos de texto para no recortar campos extensos.

SAM describe HTTP API, Lambda Python 3.12, DynamoDB cifrado on-demand y permisos GetItem/PutItem/Scan de la tabla e InvokeModel del modelo regional configurado. Perfiles de inferencia necesitan una decisión IAM explícita. **T084** es el equipo esperado, aunque el nombre histórico del stack empieza con t054.

La validación local histórica de SAM y el despliegue anterior no acreditan estas funciones nuevas en AWS. QA de navegador, llamadas reales y despliegue/verificación de esta versión siguen pendientes. Hooks Kiro actuales y legacy son artefactos candidatos; el legacy está deshabilitado y no ejecutado. Pruebas offline independientes no demuestran activación de hooks.
