---
inclusion: always
---
# Teacher copilot project boundaries

Build for the public-school teacher who needs to transform a training module into an editable lesson and retain a short, anonymous classroom reflection. The product language is professional Spanish; technical artifacts and comments are English. Use Python 3.12 Lambda, a buildless browser UI, SAM, DynamoDB and Bedrock Converse. Local development must reuse the actual Lambda handler with stdlib SQLite and an explicitly labeled deterministic demonstration mode. Never portray a sample as real AI.

Keep the four-view workflow: Crear curso, Preparar clase, Revisar sesión, Portafolio. Course segmentation is a fixed local demonstration, not AI analysis or a server-side course. The teacher reviews every proposal. Use only fictional/public course samples and anonymous group-level text evidence. Do not add authentication, student profiles, uploads, a generic chat, or cloud provisioning without a new decision. Render untrusted content as text, bound all input, preserve opaque challenge nonces exactly, and test changes before claiming completion. No credentials, deployment, commit, or account mutations are authorized by this artifact.

Official competition kit, five official CANVAS prompts, and organizer RETOS have not been received. Team drafts are provisional. Kiro files were authored as project artifacts; Kiro execution and hook activation remain unverified. From teacher-copilot, run offline contracts with `.venv/bin/python -m unittest discover -s tests -v` and JS syntax with `node --check src/web/app.js`.
