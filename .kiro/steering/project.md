---
inclusion: always
---
# Límites del copiloto docente

Ayudar al docente público a convertir un sílabo o módulo en una sesión editable y conservar reflexiones anónimas del aula. UI y documentación de producto en español profesional; comentarios de código en inglés. Usar Python 3.12 Lambda, UI sin compilación, SAM, DynamoDB y Bedrock Converse. El servidor local reutiliza el handler con SQLite. Demo es determinista y explícito para cada operación; nunca presentarlo como IA real ni hacer fallback silencioso.

Mantener Crear curso, Preparar clase, Revisar sesión y Portafolio. El proveedor configurado organiza el sílabo en módulos editables con objetivo y fuente. El curso completo permanece local; `customModule` y `courseName` llevan la fuente real elegida a generación y a la sesión durable. Mejorar cambia solo un momento y conserva los demás textos/tiempos. Los tres presets adaptan el borrador actual sin cambiar tiempos. La rúbrica es editable y se guarda con la sesión. Impresión/PDF por navegador incluye la ficha completa actual y rúbrica como texto normal. El docente revisa toda propuesta.

Usar datos ficticios/públicos y evidencias anónimas grupales. No añadir autenticación, perfiles de estudiantes, archivos ni chat genérico sin nueva decisión. Renderizar entradas/modelo como texto, conservar nonces opacos y probar antes de afirmar resultados. Equipo predeterminado/esperado: T084, independientemente del nombre histórico del stack. Las autorizaciones de cuenta, publicación y despliegue se verifican por separado; este archivo no las concede ni revoca.

Kit oficial, cinco preguntas CANVAS y RETOS del organizador pendientes. Artefactos del equipo provisionales. Hooks Kiro no validados en runtime; legacy deshabilitado y no ejecutado. QA de las funciones nuevas, Bedrock real y despliegue de esta versión siguen pendientes. Desde `teacher-copilot`: `.venv/bin/python -m unittest discover -s tests -v`, `node --check src/web/app.js` y `node --test tests/course_frontend.test.cjs`. La evidencia SAM histórica no sustituye revalidación ni despliegue actual.
