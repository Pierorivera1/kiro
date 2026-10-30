# Copiloto del docente público

Prototipo para ayudar a docentes a preparar sesiones de clase editables y registrar observaciones anónimas del aula. La interfaz está en español y requiere que el docente revise las propuestas antes de usarlas.

## Qué permite hacer

- Crear un borrador de curso y pegar el texto de un sílabo. La segmentación muestra dos módulos de ejemplo: no analiza el texto ni lo envía a una IA.
- Preparar una clase a partir de un módulo ficticio y del contexto del aula.
- Revisar y editar el objetivo, los momentos, los tiempos y la evaluación de la sesión.
- Guardar sesiones y añadir evidencias de texto anónimas en el portafolio.

El modo local predeterminado genera respuestas deterministas de demostración, no respuestas de IA. El curso y el sílabo se guardan en el navegador; las sesiones y evidencias se guardan en SQLite. La aplicación no tiene autenticación: utiliza únicamente datos ficticios u observaciones anónimas, sin información personal de estudiantes.

## Ejecutar en local

Necesitas Python 3.12. Desde la raíz del repositorio:

```sh
cd teacher-copilot
python3.12 -m venv .venv
.venv/bin/python scripts/dev_server.py --port 8765
```

Abre [http://127.0.0.1:8765/app](http://127.0.0.1:8765/app). El modo de demostración no necesita instalar dependencias ni conectarse a AWS. Los datos del servidor se conservan en `teacher-copilot/.local/copiloto.sqlite3`. Para detenerlo, pulsa `Ctrl+C`.

## Arquitectura y estado

La interfaz usa HTML, CSS y JavaScript sin compilación. El servidor local ejecuta el mismo controlador Python que usa AWS Lambda. El almacenamiento local utiliza SQLite; la plantilla SAM configura DynamoDB y Amazon Bedrock para una posible implementación en AWS. La segmentación del curso sigue siendo una demostración local incluso cuando se configura Bedrock para generar sesiones.

La plantilla de AWS está incluida en `teacher-copilot/template.yaml`. Hubo un despliegue de demostración anterior del stack `t054-teacher-copilot` en `us-east-1`: SAM configuró API Gateway, Lambda, DynamoDB y acceso a Bedrock. Con datos ficticios se comprobó una generación de sesión mediante Bedrock (HTTP 201) y su posterior recuperación (HTTP 200). En otra prueba se observó un error HTTP 502 intermitente; la fiabilidad no está plenamente verificada. Esta evidencia corresponde al despliegue anterior con equipo **T054**, no demuestra que el código actual o la configuración **T084** estén desplegados. No introduzcas datos reales: la API de demostración es pública y no tiene autenticación.

### Límites de entrada

| Campo | Límite |
| --- | --- |
| Cuerpo recibido por el handler | 50 000 caracteres, antes de decodificar Base64 si corresponde |
| Nombre de curso / sílabo (borrador en el navegador) | 160 / 12 000 caracteres |
| Grado / contexto del aula | 80 / 1 200 caracteres |
| Duración total | Entero entre 30 y 180 minutos; los tres momentos deben sumar el total |
| Título / objetivo / evaluación | 160 / 1 000 / 2 000 caracteres |
| Texto de cada momento / evidencia | 3 500 / 3 000 caracteres |
| Valor de los endpoints de prueba (`items` y `jobs`) | 1–2 000 caracteres |

Los límites del curso son controles de la interfaz local, no validación de una API de creación de cursos.

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

Las pruebas de Python cubren, entre otros casos, sesiones, evidencias, validación de entradas y respuestas simuladas de Bedrock. Las pruebas de interfaz requieren Node.js. La última instrucción requiere AWS SAM CLI y `cfn-lint`; ejecútala y registra su resultado antes de afirmar que la plantilla pasó esa validación.

## Estructura

- `teacher-copilot/src/`: controlador, generación, almacenamiento e interfaz web.
- `teacher-copilot/scripts/`: servidor de desarrollo local.
- `teacher-copilot/tests/`: pruebas automatizadas.
- `.kiro/`: especificaciones, instrucciones y configuración de hooks del proyecto.
