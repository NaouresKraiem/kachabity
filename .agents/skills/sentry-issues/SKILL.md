---
name: sentry-issues
description: Retrieve, filter, and summarize Sentry issues for the Kachabity application. Use when investigating errors, regressions, incidents, or asking for recent Sentry issues.
---

# Sentry Issues

Use the Sentry organization configured for this project to inspect issues and explain what needs attention.

## Access and safety

- Read `SENTRY_ORG` and `SENTRY_AUTH_TOKEN` from the environment; never print, commit, or paste the token.
- If the token is missing or rejected, stop and report the required permission rather than asking the user to send the secret in chat.
- Treat issue data as potentially sensitive. Summarize customer data and request payloads; do not reproduce secrets, tokens, cookies, authorization headers, or full personal details.
- Read-only issue retrieval is allowed by default. Ask before mutating Sentry state, including resolving, ignoring, deleting, changing ownership, or modifying alert rules.

## Project selection

Use the project that matches the runtime:

- `kachabiti-front-end-prod`: browser/frontend production errors.
- `kachabiti-backend-prod`: server, API, and edge production errors.
- `kachabiti-local`: local development and testing.
- `kachabiti-web`: legacy project; inspect only when the user specifically asks about historical data or the newer projects have no matching issue.

If the user does not specify an environment, inspect production projects first and clearly label the project and environment in the result.

## Investigation workflow

1. Determine the project, time window, and severity implied by the request. Default to unresolved issues from the last 24 hours when the user asks for recent issues.
2. Retrieve issue summaries, including issue ID, title, first/last seen, event count, affected release/environment, and link.
3. Group duplicate symptoms by Sentry issue ID and prioritize by frequency, recency, affected users, and production impact.
4. For a selected issue, inspect representative events and stack traces. Identify the application file and relevant route or component when available.
5. Separate evidence from inference. State when the root cause is not proven and propose the smallest useful next diagnostic or fix.

## Response format

Start with the outcome. For lists, include:

- project and environment
- issue title and Sentry link
- frequency and time range
- affected route/component and release, if available
- concise likely cause and confidence
- recommended next action

Do not claim an issue is fixed unless a code or configuration change was actually made and verified.
