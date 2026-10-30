# Teacher copilot requirements

Status: implemented locally; cloud and Kiro runtime verification pending. This is a team-authored specification, not an organizer-supplied kit.

## Core story

As a public-school teacher, I can select a clearly fictional training module, describe my grade, class duration and available resources, generate an editable lesson proposal, save the reviewed session and attach anonymous text evidence after class. The four views are Crear curso, Preparar clase, Revisar sesión and Portafolio. The optional course preview accepts a course name and syllabus text, presents two fixed example modules with their example source excerpts, and asks the teacher to review and confirm that sample before continuing. No student records, file uploads, authentication or generic chat are in scope.

## Acceptance contracts

The course preview is a static demonstration: it does not analyze the entered syllabus or call AI, and its course name and syllabus are stored only in the browser when localStorage is available. The preview is not a server-side course and its context is not associated with saved portfolio sessions. Teachers can skip it and prepare a class directly. Real syllabus extraction is future work, not an implemented feature.

1. GET /modules returns labeled fictional source text. POST /sessions/generate uses that source plus bounded teacher context and persists an editable draft. Objective, opening, development, closing, assessment and three durations are required. Durations must sum to the requested 30–180 minutes.
2. PUT /sessions/{id}, GET /sessions/{id} and GET /sessions preserve reviewed lessons. GET/POST /sessions/{id}/evidence persists only text linked to an existing session; another session must not see it. A shared prototype is not an authenticated ownership system.
3. Ordinary navigation preserves unsaved lesson and evidence drafts; browser-local backup survives reload where localStorage is available. Offline/provider failures are disclosed, preserve user inputs and permit retry. Browser storage is not a server save or a multi-device synchronization guarantee.
4. Demonstration mode states exactly: “Modo demostración: respuesta de ejemplo, no IA real”. AWS defaults to Bedrock Converse and never silently substitutes a sample. Provider validation errors return 400, exhausted throttling/other provider errors return 502. Model JSON is independently validated.
5. GET /health returns 200 with status=ok and configurable team=T054. Item endpoints create/read/list opaque values exactly, including Unicode and whitespace. DynamoDB list scans follow pagination and return at most 100 item records, excluding other entity kinds.
6. Jobs return 202 immediately with jobId; reads first report queued, then done after readyAt=creation+2s, with output equal to input[::-1]. This is disclosed persisted lazy completion, not a queue or agent.
7. Unknown identifiers/routes return 404; known unsupported methods return 405 with Allow. GET /app returns HTML directly. User/model text is rendered with safe text APIs, not HTML injection. Controls are labeled, keyboard accessible and responsive.

## Limits and remaining validation

Requests are capped at 50,000 encoded characters; item/job values at 2,000 characters, grade at 80, teacher context at 1,200, title at 160, objective at 1,000, phase text at 3,500 each, assessment at 2,000 and evidence at 3,000. Lists expose at most 100 matching records. Real Bedrock access/model availability, AWS timing, infrastructure deployment, installed Kiro compatibility and official challenge alignment remain pending.
