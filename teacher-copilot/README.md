# Copiloto del docente público — helping a public-school teacher turn course modules into editable lessons and classroom evidence

A real local prototype: select a fictional module, describe the classroom, generate a proposal, edit/save the lesson, and attach anonymous text evidence. Spanish UI; Python Lambda handler; persistent SQLite locally; SAM/DynamoDB/Bedrock implementation for AWS deployment. **Official competition kit not received. CANVAS.md and RETOS.md are PROVISIONAL TEAM DRAFTS, not organizer files.**

## Run locally — no AWS, Docker, SAM or dependency installation needed

From the repository root, with Python 3.12 installed:

```sh
python3.12 -m venv .venv
.venv/bin/python scripts/dev_server.py --port 8765
```

Open [the local application](http://127.0.0.1:8765/app). The server defaults explicitly to `--mode demo`. The page states **“Modo demostración: respuesta de ejemplo, no IA real”**. The example is derived from the selected module and classroom context, but is deterministic, not GenAI. Changes persist in ignored `.local/copiloto.sqlite3`; restart the same command to recover sessions/evidence. Stop with Ctrl+C. Change `--port` if occupied.

The local server calls **the same `src/app.py:handler`** used by Lambda, not a separate mock API. Browser edits/evidence drafts are backed up in localStorage where available; only successful server saves are durable across devices. The UI discloses storage denial. Do not close the tab with unsaved work if browser storage is unavailable. This prototype is shared and unauthenticated: use only fictional or anonymous group-level text, never student identities or confidential records.

## Demonstrate in three steps (about 9 primary actions)

1. **Preparar clase**: choose a sample module, change the editable classroom context, select **Generar propuesta**.
2. **Revisar sesión**: review/edit objective, three moments and assessment, keep the three time values equal to the total, select **Guardar sesión**.
3. **Portafolio**: select **Añadir evidencia** on that session, enter an anonymous group observation/next step, select **Guardar evidencia**. Reopen **Editar sesión** to verify persistence.

All course text is fictional and labeled. Teacher review is mandatory; no official curricular alignment or learning improvement is claimed. No uploads, student profiles, authentication, generic chat, or unrelated reminder records are included.

## Verify offline

```sh
.venv/bin/python -m unittest discover -s tests -v
node --check src/web/app.js
```

No network or AWS calls occur in these tests. They cover health/team configuration, item Unicode/whitespace round trips and pagination, queued/done jobs, lesson persistence and evidence links, input errors, HTML assets, immutable provenance, and mocked Bedrock success/throttling/validation/failure/invalid JSON. A pytest runner is optional, not needed:

```sh
# Optional dependency installation: repository venv only, never global.
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests -q
```

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
| PUT /sessions/{id} | title, objective, opening/development/closing `{text,minutes}`, assessment; validated update |
| GET/POST /sessions/{id}/evidence | List or create `{text}`; existing session required, linked sessionId preserved |
| GET /app; GET /app/assets/{app.js,style.css} | Direct HTML/CSS/JS delivery, no redirect required |

Unknown routes/IDs return 404; unsupported methods on known routes return 405 with Allow. JSON errors are disclosed in Spanish. Jobs are **persisted lazy completion**, not a queue/agent; work completes on a GET after readyAt. Unicode reversal uses Python code-point slicing, not grapheme normalization. Nonces are opaque and preserve whitespace exactly.

### Cost/safety boundaries

Maximum: 50,000 encoded request characters, 2,000 nonce characters, 80 grade, 1,200 classroom context, 160 title, 1,000 objective, 3,500 per phase, 2,000 assessment, 3,000 evidence. Total lesson time is 30–180 minutes; all phase minutes are positive integers and must sum exactly. All lists cap at 100 matching records. `/items` selects the newest 100 by server creation time; legacy items lack timestamps. DynamoDB scans up to 10,000 evaluated records across all kinds and fails instead of returning a silently incomplete ranking beyond that budget. This bounded scan is for the demonstration, not a scalable production index. Concurrent writes and server clock skew can affect ordering. Browser content uses textContent/value, never user/model HTML. CSP restricts scripts, styles, connections and embedding. Server logs do not contain submitted text or model payloads. A production data retention/access-control design is out of scope.

## AWS deployment

A previous prototype deployment exists in the workshop account, but the T084 configuration and new HTTP tests in this change have not yet been deployed or verified in the competition portal. Deployment uses potentially billable API Gateway HTTP API, Lambda, DynamoDB, Bedrock and logging resources. Verify the account, region, permissions and model access before deploying.

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

Bedrock uses Converse (1,800 max output tokens), independent JSON validation, two short backoffs and at most three total attempts on throttling. Provider validation returns 400; exhausted throttling/other failure or malformed output returns 502 without a silent sample fallback. The teacher's browser context survives retry.

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
- [x] Desktop browser flow: proposal, edit/save, evidence, and persistence after reload; fresh independent code review (no confirmed P1/P2 findings).
- [ ] Mobile and full keyboard interaction QA.
- [ ] SAM schema/transform validation (`sam` unavailable; syntax checks alone are insufficient).
- [ ] Official kit reconciliation and exact five CANVAS prompts.
- [ ] Installed Kiro runtime validation.
- [ ] Deploy the T084 configuration and verify all three badge contracts against the public endpoint and competition portal.
- [ ] Final evaluator URL, <=16-action flow and submission-note confirmation.

This initial local change is larger than a 400-line PR; no commit, push or PR was created. Review by behavior: storage/badge contracts → generation/lesson/evidence → browser flow → infrastructure/docs. Future reviewable slices should keep tests/docs with behavior, not split by file type.

## Technical references

The implementation follows primary [SAM HTTP API event documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapi.html) and [Boto3 Converse documentation](https://docs.aws.amazon.com/boto3/latest/reference/services/bedrock-runtime/client/converse.html). Docs establish API shapes, not account access or deployment success.
