# Requisitos del copiloto docente

Estado: cinco funciones de producto implementadas localmente; su QA de navegador, validación con Bedrock real y despliegue de esta versión siguen pendientes. Especificación del equipo; no sustituye al kit oficial.

## Recorrido principal

El docente organiza un sílabo en módulos editables, confirma la propuesta, prepara una sesión con el módulo elegido, mejora un momento, adapta actividades, crea una rúbrica y guarda o imprime su versión revisada. Las cuatro vistas son Crear curso, Preparar clase, Revisar sesión y Portafolio. También puede omitir el curso y usar módulos ficticios de ejemplo. No se incluyen estudiantes, archivos, autenticación ni chat genérico.

## Contratos de producto

1. `POST /courses/generate` recibe `{name,syllabus}` y usa el proveedor configurado para devolver hasta seis módulos con `id`, `title`, `objective`, `text` y procedencia. El docente puede editar título, objetivo y fuente antes de confirmar. El borrador del curso/sílabo permanece en localStorage cuando está disponible; no existe un registro servidor del curso completo.
2. `GET /modules` conserva las fuentes ficticias de ejemplo. `POST /sessions/generate` acepta `moduleId`, `grade`, `context`, `duration` y, para un curso propio, `customModule:{id,title,objective,text}` y `courseName`. El módulo real editado alimenta la generación; el servidor persiste la sesión con su fuente, objetivo del módulo y nombre del curso. Objetivo, inicio, desarrollo, cierre, evaluación y tres tiempos son editables; los tiempos deben sumar los 30–180 minutos solicitados.
3. `POST /sessions/{id}/rubric` usa `{lesson}` con las ediciones actuales y devuelve criterios con descriptores Inicio / En proceso / Logrado. El docente edita la rúbrica y la guarda con `PUT /sessions/{id}`; lecturas individuales y portafolio la recuperan.
4. `POST /sessions/{id}/improve` recibe `{lesson,phase,instruction}`. La UI aplica únicamente el texto del momento elegido (inicio, desarrollo o cierre), sin cambiar otros textos ni ningún tiempo.
5. `POST /sessions/{id}/adapt` adapta el borrador actual. Los tres botones son Sin internet, Aula multigrado y Pocos materiales. Se conservan los tiempos de cada momento y la rúbrica existente; el docente revisa o regenera la rúbrica si corresponde. Rúbrica, mejora y adaptación no guardan automáticamente: el docente confirma con Guardar sesión.
6. Imprimir / guardar PDF incluye el contenido completo de la versión actual —también ediciones sin guardar—, fuente, contexto, momentos, tiempos y rúbrica. Se genera una ficha de texto normal, no controles recortados. PDF usa el diálogo del navegador; no existe servicio PDF.

## Persistencia y procedencia

`PUT /sessions/{id}`, `GET /sessions/{id}` y `GET /sessions` conservan sesiones revisadas, fuente, rúbrica y adaptación. `GET/POST /sessions/{id}/evidence` conserva únicamente texto asociado a una sesión existente; otra sesión no lo recibe. El prototipo compartido no ofrece propiedad autenticada.

Navegación ordinaria conserva borradores de sesión y evidencia; localStorage permite recuperarlos tras recarga cuando está disponible. Fallos de red/proveedor se muestran sin descartar entradas y permiten reintento. El almacenamiento local no es guardado servidor ni sincronización multidispositivo.

Bedrock usa Converse para organizar sílabos, generar sesiones, rúbricas, mejoras y adaptaciones. Demo es determinista y explícito en todas esas operaciones: «Modo demostración: respuesta de ejemplo, no IA real». Nunca hay fallback silencioso. Errores de validación del proveedor devuelven 400; throttling agotado, otros fallos o JSON de modelo inválido devuelven 502. El servidor valida la salida y preserva la procedencia al editar.

## Contratos base conservados

- `GET /health`: 200, `status=ok`, equipo configurable con predeterminado **T084**. `GET /config` expone modo y equipo.
- Items conservan valores opacos exactamente, incluidos Unicode y espacios. La lista devuelve hasta los 100 más recientes; DynamoDB pagina hasta un presupuesto de 10 000 registros evaluados y falla en vez de ocultar una clasificación incompleta.
- Jobs devuelven 202 con `jobId`; una lectura anterior a `readyAt=creación+2s` informa queued, y una posterior completa done con `input[::-1]`. Es finalización diferida persistida, no cola ni agente.
- Rutas/identificadores desconocidos: 404. Métodos no admitidos en rutas conocidas: 405 con Allow. `/app` sirve HTML directamente. Texto del usuario/modelo se renderiza como texto; controles etiquetados y diseño adaptable requieren QA real.

## Límites y evidencia pendiente

Cuerpo: 50 000 caracteres recibidos; nombre de curso/sílabo: 160/12 000; módulo personalizado: id 80, título 160, objetivo 1 000, fuente 3 500; grado/contexto/indicación: 80/1 200/1 200; objetivo de sesión 1 000, fase 3 500, evaluación 2 000, evidencia 3 000; nonce 1–2 000. Rúbrica: 1–6 criterios de hasta 300 caracteres y tres descriptores de hasta 700 cada uno. Listas: hasta 100 registros coincidentes.

Las pruebas locales y respuestas simuladas no prueban Bedrock real ni publicación. Siguen pendientes QA de las cinco funciones en navegador, modelo/IAM de esta versión, despliegue y contratos públicos, tiempos AWS, compatibilidad de Kiro y alineación con el kit oficial.
