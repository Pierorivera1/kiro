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

La plantilla de AWS está incluida en `teacher-copilot/template.yaml`. Su presencia no confirma que el despliegue ni el acceso al modelo se hayan verificado. El prototipo no está preparado para datos reales de estudiantes ni para uso público sin controles de acceso.

## Comprobaciones

Desde `teacher-copilot`:

```sh
.venv/bin/python -m unittest discover -s tests -v
node --check src/web/app.js
```

Las pruebas de Python cubren, entre otros casos, sesiones, evidencias, validación de entradas y respuestas simuladas de Bedrock. La segunda instrucción comprueba la sintaxis de JavaScript y requiere Node.js.

## Estructura

- `teacher-copilot/src/`: controlador, generación, almacenamiento e interfaz web.
- `teacher-copilot/scripts/`: servidor de desarrollo local.
- `teacher-copilot/tests/`: pruebas automatizadas.
- `.kiro/`: especificaciones, instrucciones y configuración de hooks del proyecto.
