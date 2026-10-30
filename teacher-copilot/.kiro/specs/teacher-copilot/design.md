# Teacher copilot design

## Runtime and data

One Python Lambda handler routes both HTTP API requests and static assets. GET /app directly serves index.html with text/html; absolute /app/assets paths avoid trailing-slash assumptions. The local ThreadingHTTPServer translates requests into the same HTTP API v2 event shape and invokes the same handler. Stdlib SQLite persists ignored .local/copiloto.sqlite3; deployment selects DynamoDB through TABLE_NAME.

Storage separates item, job, session and evidence kinds. DynamoDB uses pk=<kind>#<uuid>, kind and owner metadata plus a JSON data payload. JSON avoids DynamoDB float serialization for job timestamps. Strong reads and filtered scan pagination support immediate verification. The small prototype uses capped scans, not an unbounded production-scale query design. Evidence owner is its sessionId; this is referential association, not user authentication. There is no private per-user isolation.

## Generation and trust

The client sends moduleId, grade, context and duration. The server selects source text from its own module catalog and whitelists the context. Bedrock Converse receives an instruction/data separation, a provider-independent JSON schema description, maxTokens=1800 and temperature=0.3. Output is parsed and independently validated. Three attempts only for throttling, with 0.25s and 0.5s backoff; SDK retries are disabled so attempts do not multiply. Connect/read timeouts bound provider work under the API timeout. A configured same-region foundation model is IAM-scoped; profile-based routing requires deliberate policy extension.

Demonstration generation is a separate explicit provider. Provenance is assigned by the server and preserved on edits. Provider failures are errors, never AI-labeled fallback. The teacher has final responsibility for relevance and accuracy. Inputs and model responses are not logged. The browser uses textContent/value and a restrictive Content Security Policy.

## Browser state and constraints

The buildless UI has four semantic views—Crear curso, Preparar clase, Revisar sesión and Portafolio—and no framework dependency. The optional course flow collects a name and syllabus text, shows two predefined example modules and their example source excerpts, and requires an explicit teacher review before confirmation. Custom syllabus text is retained as a local draft but is not analyzed or sent to AI. Course context stays in localStorage when available, is not a server-side course, and is not attached to saved sessions. The teacher can skip the course flow. Real syllabus extraction is future work, not an implemented feature. Current preparation, per-session unsaved edits and per-session evidence drafts persist to localStorage; records persist independently on the server. Navigation does not discard edits, and an edit during a save request is not overwritten by the older response. Storage denial is disclosed. The prototype is shared and unauthenticated: use fictional/anonymized data only, isolate any evaluation deployment, and add access controls before real teacher/student use.

## Infrastructure and unresolved evidence

SAM defines HTTP API, Python 3.12 Lambda and on-demand encrypted DynamoDB with only GetItem, PutItem, Scan and the selected foundation model's InvokeModel permission. Resource creation and costs require explicit future approval. No deployment or real Bedrock call has been performed. Kiro hook files are candidates derived from official current and legacy documentation; only independent offline checks are verified, not hook activation.
