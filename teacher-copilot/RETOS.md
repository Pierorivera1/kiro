# PROVISIONAL TEAM DRAFT — Selected challenge and constraints

**This is not the organizer's RETOS file.** It is a team-authored working interpretation based on the public baseline captured during planning. No official kit, additional hidden requirements or official materials have been received. Reconcile this document before submitting.

## Selected track

Copiloto del docente público. The implemented local slice follows training module → editable lesson session → evidence portfolio. Course snippets are fictional and labeled. The user approved Spanish interface labels and proceeding without the kit. Nothing here claims organizer approval, badge award or evaluation success.

## Public technical baseline carried into implementation

| Contract | Local implementation |
| --- | --- |
| Python 3.12 Lambda + SAM HTTP API | src/app.py and template.yaml; same handler locally |
| DynamoDB persistence | Typed pk records; item scans paginate and cap at 100 matches |
| Amazon Bedrock | Converse provider, configurable model; real execution pending |
| GET /health | status=ok, team configurable; default T084 |
| POST/GET /items and GET /items/{id} | Exact opaque nonce round-trip; no trimming |
| POST /jobs and GET /jobs/{jobId} | 202, queued, then lazy done after two seconds, exact reversed input |
| Direct frontend route | GET /app HTML from Lambda, with separate static assets |
| Kiro project artifacts | Specs, steering and hook candidates authored; no Kiro execution claimed |

The public baseline permits readyAt-based lazy completion for the badge job. This implementation is deliberately not called a queue, agent or background worker. The cloud <12-second behavior still needs measurement after an authorized deployment.

## Submission/evaluation draft checklist

- [x] Real local module-to-session-to-evidence flow; no sample-only button behavior.
- [x] Explicit distinction between deterministic demonstration and real AI.
- [x] Configurable TeamId=T084 and scoped data/model policies.
- [x] Provisional materials clearly distinguished from organizer files.
- [ ] Official five CANVAS prompts and selected-track text confirmed.
- [ ] Actual installed Kiro hook activation evidenced.
- [ ] SAM transform validation, AWS deployment and real Bedrock result evidenced.
- [ ] Public endpoint smoke checks and evaluator flow verified on the final URL.
- [ ] Final candidate frontend/GenAI note reviewed against the actual portal limits.

## Non-goals

No real student PII, uploads, auth/roles, map, chat, personal data seed, unrelated reminders, cloud registration, account mutations or autonomous deployment. The shared prototype is unsuitable for confidential classroom data. Development and generated content remain subject to teacher review and official-kit reconciliation.
