# Copiloto del docente público — helping a public-school teacher turn course modules into editable lessons and classroom evidence

A teacher workflow: organize a pasted syllabus into editable modules, generate a lesson from the chosen source, improve one section, adapt activities to the classroom, create an editable rubric, and print the current session or save it as PDF. Sessions, source material, rubrics and anonymous text evidence are durable server records. Spanish UI; Python Lambda handler; persistent SQLite locally; SAM/DynamoDB/Bedrock implementation for AWS deployment. **Official competition kit not received. CANVAS.md and RETOS.md are PROVISIONAL TEAM DRAFTS, not organizer files.**

## Run locally — no AWS, Docker, SAM or dependency installation needed

Run all commands in this README from the `teacher-copilot` application directory (not the repository root), with Python 3.12 installed:

```sh
python3.12 -m venv .venv
.venv/bin/python scripts/dev_server.py --port 8765
```

Open [the local application](http://127.0.0.1:8765/app). The server defaults explicitly to `--mode demo`. The page states **“Modo demostración: respuesta de ejemplo, no IA real”**. The example is derived from the selected module and classroom context, but is deterministic, not GenAI. Changes persist in ignored `.local/copiloto.sqlite3`; restart the same command to recover sessions/evidence. Stop with Ctrl+C. Change `--port` if occupied.

The local server calls **the same `src/app.py:handler`** used by Lambda, not a separate mock API. Browser edits/evidence drafts are backed up in localStorage where available; only successful server saves are durable across devices. The UI discloses storage denial. Do not close the tab with unsaved work if browser storage is unavailable. This prototype is shared and unauthenticated: use only fictional or anonymous group-level text, never student identities or confidential records.

## Product happy path

1. **Crear curso:** name the course, paste a fictional syllabus and choose **Organizar sílabo con IA**. Edit module titles, objectives and source excerpts, then confirm the route.
2. **Preparar clase:** choose a generated module and classroom context. Its actual title, objective and source text travel to the lesson generator; the saved session retains the source and course name.
3. **Revisar sesión:** edit the proposal. **Mejorar esta parte** changes only the selected phase text, not its minutes or other edits. The classroom buttons adapt the current session for offline, multigrade or few-material settings while retaining planned phase times.
4. **Rúbrica:** generate criteria with Inicio / En proceso / Logrado descriptors, edit any field and **Guardar sesión**. Reopen it from the portfolio to recover the rubric too. Adaptation retains an existing rubric; regenerate it if the new activities require different evidence.
5. **Imprimir / guardar PDF:** print the current edited version, including unsaved text and the complete rubric. Select the browser's **Save as PDF** destination. The printable sheet uses normal text paragraphs rather than clipped form controls; there is no PDF service or download library.
6. **Portafolio:** add an anonymous group observation/next step as evidence. Evidence is stored text, not AI analysis.

The course draft (including the syllabus) remains browser-local. Module generation sends its name and syllabus to the configured provider. The chosen module and course name become durable with the generated session; rubric edits and adaptations become durable when the teacher saves. No student records, file uploads, authentication or generic chat are included. Teacher review is still required; no official curricular alignment or learning improvement is claimed.

Local `demo` mode uses clearly disclosed deterministic examples for **all** generation operations, including course and rubric. Set `--mode bedrock` and the authorized model/region to use real Converse; there is no silent demo fallback.

## Verify offline

```sh
.venv/bin/python -m unittest discover -s tests -v
node --check src/web/app.js
node --test tests/course_frontend.test.cjs
```

No network or AWS calls occur in these tests. They cover health/team configuration, item Unicode/whitespace round trips and pagination, queued/done jobs, lesson persistence and evidence links, input errors, HTML assets, immutable provenance, and mocked Bedrock success/throttling/validation/failure/invalid JSON. A pytest runner is optional, not needed:

```sh
# Optional dependency installation: repository venv only, never global.
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests -q
```

### Comprobación automatizada actual — 30/10/2026

Esta versión pasó **28 pruebas Python** (`python3.12 -m unittest discover -s tests -v`), **16 pruebas Node** (`node --test tests/course_frontend.test.cjs`) y `node --check src/web/app.js`, ejecutadas desde `teacher-copilot`. La suite HTTP local requirió permiso de loopback fuera del sandbox. Son pruebas locales con demo/mocks, no llamadas reales a Bedrock, QA visual de navegador ni evidencia de despliegue. En esta copia se usó `python3.12` disponible en el sistema; no se creó ni instaló un entorno para esta comprobación.

### Evidencia local histórica — 30/10/2026

En una comprobación anterior se registraron `.venv` con **Python 3.12.15**, **23 pruebas Python y 7 pruebas Node aprobadas**, **AWS SAM CLI 1.171.0**, **cfn-lint 1.59.0** y **`sam validate --lint` aprobado**. Es evidencia histórica local: no acredita las cinco funciones nuevas, llamadas reales a Bedrock, verificación pública ni despliegue de esta versión. No presupone que esas herramientas o ese entorno estén disponibles en otra copia del repositorio.

### Recorded test-first evidence

- Initial RED: `python3 -m pytest tests -q` → collection failure because `app` did not exist yet (not a passing behavior assertion).
- Intermediate RED: after backend implementation → 13 passed, HTML-assets test failed with 500 because frontend assets had not yet been created.
- Specific regression RED: whitespace-only opaque nonce returned 400 instead of 201. Fixed by separate non-trimming length validation, rather than using pedagogical nonblank-text validation.
- GREEN: project Python 3.12 venv, `python -m unittest discover -s tests -v` → 15 tests passed; Node syntax check passed. No packages were installed during initialization. See final handoff for subsequent QA/review results.

## Badge verification and deployment status

The badge evaluator requires the **API base URL**, without `/app` or a trailing slash.
The frontend URL is separate and ends in `/app`. The expected team is `T084`,
which can be overridden with `TEAM_ID` locally or `TeamId` in SAM. CloudFormation
parameter values from an existing stack can remain unchanged when defaults change;
explicitly pass `TeamId=T084` during the next authorized deployment and verify
`GET /health` returns the correct team before updating the portal profile. Local
changes alone do not update the deployed application or portal, and no badge
verification or score is claimed by local tests.

The jobs endpoint models asynchronous completion lazily on a later GET; it does
not launch a background worker. The observable contract is tested over HTTP.
Run `python3 -m unittest discover -s tests -v` to exercise it with a temporary
SQLite database, including persistence after restart and Unicode round trips.

## API quick reference

| Route | Contract |
| --- | --- |
| GET /health | `200 {"status":"ok","team":"T084"}`; TEAM_ID configurable |
| POST /items `{"value":"nonce"}` | `201 {"id":"…","value":"nonce"}` |
| GET /items/{id}; GET /items | Exact read or 404; `{"items":[…]}` up to 100 most recent **item** records; DynamoDB scans every page up to a 10,000 evaluated-record budget |
| POST /jobs `{"input":"nonce"}` | Immediate `202 {"jobId":"…"}` |
| GET /jobs/{jobId} | queued, then done with exact reversed input after creation+2s |
| GET /modules; GET /config | Labeled fictional sources; disclosed demo/bedrock mode |
| POST /sessions/generate | moduleId, grade, context, integer duration; 201 persisted editable draft |
| GET /sessions; GET /sessions/{id} | Up to 100 sessions; full session or 404 |
| PUT /sessions/{id} | Save title, objective, phases, assessment, optional editable `rubric` and `adaptation` |
| POST /courses/generate | `{name,syllabus}` → `{name,modules:[{id,title,objective,text}],provenance}`; course draft stays in browser |
| POST /sessions/{id}/rubric | `{lesson}` snapshot → `{rubric:[{criterion,beginning,developing,achieved}],provenance}` |
| POST /sessions/{id}/improve | `{lesson,phase,instruction}` → `{text,phase,provenance}`; does not auto-save |
| POST /sessions/{id}/adapt | `{lesson,instruction}` → adapted lesson fields and `adaptation`; does not auto-save |
| GET/POST /sessions/{id}/evidence | List or create `{text}`; existing session required, linked sessionId preserved |
| GET /app; GET /app/assets/{app.js,style.css} | Direct HTML/CSS/JS delivery, no redirect required |

Unknown routes/IDs return 404; unsupported methods on known routes return 405 with Allow. JSON errors are disclosed in Spanish. Jobs are **persisted lazy completion**, not a queue/agent; work completes on a GET after readyAt. Unicode reversal uses Python code-point slicing, not grapheme normalization. Nonces are opaque and preserve whitespace exactly.

### Cost/safety boundaries

| Input | Limit |
| --- | --- |
| Handler request body | 50,000 characters as received, before Base64 decoding when applicable |
| Course name / syllabus | 160 / 12,000 characters |
| Grade / classroom context | 80 / 1,200 characters |
| Duration | Integer 30–180 minutes; all three positive phase durations must sum to the total |
| Lesson title / objective / assessment | 160 / 1,000 / 2,000 characters |
| Each phase text / evidence | 3,500 / 3,000 characters |
| Item/job nonce | 1–2,000 characters |

A custom lesson request adds `customModule:{id,title,objective,text}` and `courseName` to the existing preparation contract. Course and source limits are also checked by the handler. Rubrics contain 1–6 criteria: criterion up to 300 characters and three descriptors up to 700 each. All lists cap at 100 matching records. `/items` selects the newest 100 by server creation time; legacy items lack timestamps. DynamoDB scans up to 10,000 evaluated records across all kinds and fails instead of returning a silently incomplete ranking beyond that budget. This bounded scan is for the demonstration, not a scalable production index. Concurrent writes and server clock skew can affect ordering. Browser content uses textContent/value, never user/model HTML. CSP restricts scripts, styles, connections and embedding. Server logs do not contain submitted text or model payloads. A production data retention/access-control design is out of scope.

## AWS deployment

A previous prototype deployment of stack `t054-teacher-copilot` in `us-east-1` used SAM, API Gateway HTTP API, Lambda, DynamoDB and Bedrock. A fictional lesson was generated through Bedrock (HTTP 201) and retrieved (HTTP 200); another generation attempt returned an intermittent HTTP 502, so reliability is not fully verified. That historical evidence does not establish that these newly added product functions are deployed. Publish and deploy this working copy before presenting them through the public URL; preserve the current **T084** team parameter even though the existing stack name starts with t054. The demo API is publicly accessible without authentication: use fictional data only. These services and logging can incur charges. Verify the account, region, permissions and model access before deploying.

1. Confirm the official kit, permitted account/region, costs and deployment authorization. Obtain a usable same-region **foundation model** that supports Converse; the default `amazon.nova-lite-v1:0` is an example configuration, **not a promise of availability**. Inference-profile/cross-region model use needs a deliberate IAM change for every required resource, not a wildcard workaround.
2. Install AWS SAM CLI when authorized, install dependencies only in `.venv`, then run:

   ```sh
   sam validate --lint --template-file template.yaml
   sam build --template-file template.yaml
   # ONLY after explicit approval to create billable resources and IAM roles:
   sam deploy --guided --capabilities CAPABILITY_IAM \
     --parameter-overrides TeamId=T084 ModelId=amazon.nova-lite-v1:0
   ```

3. Use Outputs **ApiUrl** and **WebUrl** (`/app`). Verify health, opaque item read/list, queued→done within 12 seconds, actual Bedrock generation, lesson edits and evidence persistence. Record exact cloud results before claiming evaluator readiness. Review/decommission test resources when no longer needed; no cleanup command has been executed.

SAM explicitly uses `MODEL_MODE=bedrock`, never demonstration in AWS by default. DynamoDB permissions are restricted to the created table's GetItem/PutItem/Scan; Bedrock InvokeModel is restricted to the configured regional foundation model ARN. SAM also creates the Lambda execution/logging role (hence `CAPABILITY_IAM`). Basic throttling and concurrency limits are not authentication or a spending guarantee. The shared unauthenticated API must not be exposed for real school use.

To explicitly test **real Bedrock locally** later, with authorized standard AWS session credentials managed outside source (do not paste secrets into files), install `requirements.txt` in `.venv`, configure a permitted region and MODEL_ID in your shell, and run `scripts/dev_server.py --mode bedrock`. This path makes billable network calls and was **not executed**. `.env.example` is documentation only; no dotenv loader is used.

Bedrock uses Converse (1,800 max output tokens for initial lessons/rubrics, 1,300 for section improvement, 2,200 for adaptation and 2,600 for syllabus organization), independent JSON validation, two short backoffs and at most three total attempts on throttling. Provider validation returns 400; exhausted throttling/other failure or malformed output returns 502 without a silent sample fallback. The teacher's browser context survives retry.

## Kiro artifacts — authored, not runtime-validated

- `.kiro/specs/teacher-copilot/`: requirements, design and honest implementation checklist.
- `.kiro/steering/project.md`: language, architecture, privacy and execution boundaries.
- `.kiro/hooks/quality-check.json`: current `version:v1`, hooks/trigger/action format, intended PostFileSave offline checks.
- `.kiro/hooks/contract-review.kiro.hook`: valid JSON **disabled legacy when/then** candidate for the public artifact shape; not an executed workflow.

Official documentation is inconsistent across generations: current [Kiro hook schema](https://kiro.dev/docs/hooks/) uses trigger/action, while the official [earlier hook example](https://kiro.dev/blog/automate-your-development-workflow-with-agent-hooks/) uses when/then and `.kiro.hook`. Both files are intentionally distinct. Open the installed Kiro version, inspect its schema and manually run the appropriate hook before enabling the legacy file or claiming activation/bonus credit. Do not enable both blindly. The independently run offline commands do **not** prove Kiro ran a hook, authored code, or executed a spec task.

## Delivery and review checklist

- [x] Working local teacher workflow and durable text records; explicit demo disclosure.
- [x] Offline behavior tests and JavaScript syntax check.
- [x] Provisional CANVAS/RETOS, Kiro spec/steering/hook files, configurable SAM template.
- [x] Historical desktop browser flow before the five new functions: proposal, edit/save, evidence, persistence after reload and fresh independent code review (no confirmed P1/P2 findings at that point).
- [ ] Browser QA of the five new functions, including the integrated syllabus-to-session flow, rubric reopen, all classroom presets and complete print/PDF output.
- [ ] Mobile and full keyboard interaction QA.
- [x] Historical local SAM schema/transform validation: SAM 1.171.0, cfn-lint 1.59.0 and `sam validate --lint` passed on 30/10/2026.
- [ ] Revalidate the current template before deploying this version; historical validation is not deployment evidence.
- [ ] Official kit reconciliation and exact five CANVAS prompts.
- [ ] Installed Kiro runtime validation.
- [ ] Deploy the T084 configuration and verify all three badge contracts against the public endpoint and competition portal.
- [ ] Final evaluator URL, <=16-action flow and submission-note confirmation.

This initial local change is larger than a 400-line PR; no commit, push or PR was created. Review by behavior: storage/badge contracts → generation/lesson/evidence → browser flow → infrastructure/docs. Future reviewable slices should keep tests/docs with behavior, not split by file type.

## Technical references

The implementation follows primary [SAM HTTP API event documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapi.html) and [Boto3 Converse documentation](https://docs.aws.amazon.com/boto3/latest/reference/services/bedrock-runtime/client/converse.html). Docs establish API shapes, not account access or deployment success.
