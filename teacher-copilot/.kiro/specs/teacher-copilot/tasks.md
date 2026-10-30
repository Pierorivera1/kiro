# Teacher copilot implementation tasks

This checklist records actual local implementation, not evidence of work executed inside Kiro. The official kit is still absent.

- [x] Add behavior tests before the implementation. Record the initial missing-module RED and the later HTML-asset RED honestly.
- [x] Implement one Lambda handler with bounded validation, consistent errors, direct HTML asset delivery and configurable health/team identity.
- [x] Implement opaque item storage and list isolation, paginated DynamoDB filtered scans, and persisted two-second lazy jobs with exact input reversal.
- [x] Add SQLite and DynamoDB adapters, keeping local data outside tracked source.
- [x] Implement source/context-based lesson generation, validated editable sections and time totals, server saves, reads/lists and session-linked text evidence.
- [x] Add real Bedrock Converse with bounded retries/errors and explicit demonstration mode with preserved provenance.
- [x] Build the responsive Spanish four-view browser workflow with source attribution, no-PII guidance, empty/loading/error states and local unsaved-draft preservation.
- [x] Add an optional local course/syllabus preview with two fixed example modules, explicit teacher confirmation and a direct skip to preparation; disclose that no AI extraction or server-side course is created.
- [x] Add six offline Node tests for the course preview and its interaction with existing drafts and generation.
- [ ] Design and implement real syllabus extraction only as a future, separately scoped feature.
- [x] Add SAM infrastructure, dependency manifests, provisional CANVAS/RETOS, project steering and documented current/legacy hook candidates.
- [x] Run Python 3.12 offline behavior tests and Node JavaScript syntax checking; no dependencies were installed globally or outside the repository.
- [ ] Complete browser QA and fresh-context code review after the writer handoff.
- [ ] Install SAM when authorized and run sam validate --lint; syntax-only parsing does not prove SAM transform validity.
- [ ] Receive the official kit and reconcile exact CANVAS prompts, RETOS constraints and submission requirements.
- [ ] Validate the chosen region/model's Converse availability and IAM in the actual AWS account with explicit permission.
- [ ] Execute any enabled hook in the installed Kiro version and record real output before claiming compatibility or process credit.
- [ ] Only after explicit authorization: build/deploy, verify all public contracts against the real API, measure done <12s, and record final evaluator-ready evidence.

## Review workload forecast

This whole-product initialization exceeds a 400-line review budget. It is an uncommitted local handoff, not a PR. Suggested future review slices: (1) persistence and badge contracts with tests, (2) generation/lesson/evidence domain with tests, (3) browser workflow and docs/infrastructure. No commits, pushes, or PRs are authorized or created.
