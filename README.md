# Copiloto del docente público

Prototipo para ayudar a docentes a preparar sesiones de clase editables y registrar observaciones anónimas del aula. La interfaz está en español y requiere que el docente revise las propuestas antes de usarlas.

## Qué permite hacer

1. **Sílabo → curso con IA:** pegar un sílabo y obtener módulos editables con objetivo y material de partida. El módulo elegido alimenta la sesión con su contenido real, no con una muestra fija.
2. **Sesión editable:** generar objetivo, inicio, desarrollo, cierre y evaluación a partir del módulo y contexto del aula.
3. **Mejorar una parte:** pedir una versión más práctica, participativa o sencilla de un momento, conservando los otros textos y todos los tiempos.
4. **Adaptar al aula:** un clic para trabajar sin internet, con multigrado o con pocos materiales, sobre la versión que ya editó el docente.
5. **Rúbrica editable:** generar criterios y niveles Inicio / En proceso / Logrado; editar y guardar junto con la sesión.
6. **Ficha para el aula:** imprimir la sesión y su rúbrica completas, o elegir «Guardar como PDF» en el diálogo del navegador.
7. **Portafolio:** recuperar sesiones, rúbricas y evidencias de texto anónimas.

En modo **Bedrock** todas las operaciones de IA utilizan Converse. El modo local predeterminado es **demo**, determinista y explícitamente rotulado; no simula una llamada real. El curso queda en el navegador. La fuente elegida, el nombre del curso, la sesión, la adaptación y la rúbrica se conservan en SQLite o DynamoDB al guardar. La aplicación no tiene autenticación: utiliza únicamente datos ficticios u observaciones anónimas.

### Recorrido de presentación

Pega un sílabo ficticio → organiza y edita módulos → confirma y elige uno → genera la sesión → mejora un momento → adapta al aula → crea y edita la rúbrica → guarda → imprime / PDF → reabre desde el portafolio.

## Ejecutar en local

Necesitas Python 3.12. Desde la raíz del repositorio:

```sh
cd teacher-copilot
python3.12 -m venv .venv
.venv/bin/python scripts/dev_server.py --port 8765
```

Abre [http://127.0.0.1:8765/app](http://127.0.0.1:8765/app). El modo de demostración no necesita instalar dependencias ni conectarse a AWS. Los datos del servidor se conservan en `teacher-copilot/.local/copiloto.sqlite3`. Para detenerlo, pulsa `Ctrl+C`.

## Arquitectura y estado

La interfaz usa HTML, CSS y JavaScript sin compilación. El servidor local ejecuta el mismo controlador Python que usa AWS Lambda. El almacenamiento local utiliza SQLite; la plantilla SAM configura DynamoDB y Amazon Bedrock para una posible implementación en AWS. El mismo proveedor genera módulos desde el sílabo, sesiones, rúbricas, mejoras y adaptaciones. La impresión/PDF se resuelve en el navegador, sin otro servicio ni librería.

La plantilla de AWS está incluida en `teacher-copilot/template.yaml`. Las funciones nuevas están implementadas en esta copia de trabajo; un despliegue anterior **no acredita** que estén publicadas. Antes de presentarlas por la URL pública, hay que publicar y desplegar esta versión. El stack existente se llama `t054-teacher-copilot`, pero la configuración del equipo debe conservar **T084**. La API compartida es pública: utiliza únicamente datos ficticios.

### Límites de entrada

| Campo | Límite |
| --- | --- |
| Cuerpo recibido por el handler | 50 000 caracteres, antes de decodificar Base64 si corresponde |
| Nombre de curso / sílabo enviado para organizar módulos | 160 / 12 000 caracteres |
| Grado / contexto del aula | 80 / 1 200 caracteres |
| Duración total | Entero entre 30 y 180 minutos; los tres momentos deben sumar el total |
| Título / objetivo / evaluación | 160 / 1 000 / 2 000 caracteres |
| Texto de cada momento / evidencia | 3 500 / 3 000 caracteres |
| Valor de los endpoints de prueba (`items` y `jobs`) | 1–2 000 caracteres |

El curso generado contiene hasta seis módulos. La rúbrica admite hasta seis criterios editables, con un criterio (300 caracteres) y tres descriptores (700 cada uno).

### Hooks de Kiro

`.kiro/hooks/contract-review.kiro.hook` es un candidato de diseño en formato legacy, **deshabilitado**. No hay evidencia de que se haya ejecutado. El hook `quality-check.json` está configurado, pero su activación en Kiro tampoco se ha verificado; las pruebas manuales no demuestran su ejecución.

## Comprobaciones

Desde `teacher-copilot`:

```sh
.venv/bin/python -m unittest discover -s tests -v
node --check src/web/app.js
node --test tests/course_frontend.test.cjs
sam validate --lint --template-file template.yaml
```

Las pruebas de Python cubren, entre otros casos, sesiones, evidencias, validación de entradas y respuestas simuladas de Bedrock. Las pruebas de interfaz requieren Node.js. La última instrucción requiere AWS SAM CLI y `cfn-lint`; revalida la plantilla actual y registra el resultado antes del siguiente despliegue. La evidencia histórica se conserva abajo sin atribuirla a esta versión.

### Comprobación automatizada actual — 30/10/2026

Esta versión pasó **28 pruebas Python** (`python3.12 -m unittest discover -s tests -v`), **16 pruebas Node** (`node --test tests/course_frontend.test.cjs`) y `node --check src/web/app.js`, ejecutadas desde `teacher-copilot`. La suite HTTP local requirió permiso de loopback fuera del sandbox. Son pruebas locales con demo/mocks, no llamadas reales a Bedrock, QA visual de navegador ni evidencia de despliegue. En esta copia se usó `python3.12` disponible en el sistema; no se creó ni instaló un entorno para esta comprobación.

### Evidencia local histórica — 30/10/2026

En una comprobación anterior se registraron `.venv` con **Python 3.12.15**, **23 pruebas Python y 7 pruebas Node aprobadas**, **AWS SAM CLI 1.171.0**, **cfn-lint 1.59.0** y **`sam validate --lint` aprobado**. Es evidencia histórica local: no acredita las cinco funciones nuevas, llamadas reales a Bedrock, verificación pública ni despliegue de esta versión. No presupone que esas herramientas o ese entorno estén disponibles en otra copia del repositorio.

## Estructura

- `teacher-copilot/src/`: controlador, generación, almacenamiento e interfaz web.
- `teacher-copilot/scripts/`: servidor de desarrollo local.
- `teacher-copilot/tests/`: pruebas automatizadas.
- `.kiro/`: especificaciones, instrucciones y configuración de hooks del proyecto.
