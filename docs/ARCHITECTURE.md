# Architecture

```text
Browser (Next.js / React / Tailwind)
        |
        v
Next.js route handlers
  auth | spaces | projects | materials | tutor | quiz | analytics | admin
        |
        v
Application services
  retrieval | tutor context | quiz/mastery | recommendations | activity log
        |
        +---------------------> Groq (structured AI generation)
        |
        v
PostgreSQL via Prisma
  users -> spaces -> projects -> materials/chunks/conversations/quizzes/concepts
  plus activity, jobs, AI usage logs, and evaluation results
        ^
        |
Background worker (database-backed queue)
  process PDF -> chunk/extract concepts -> recommend next action
```

## Key decisions

- **Project isolation:** all project-owned data is filtered by `projectId` and ownership is verified before every project-scoped API action.
- **Grounded Tutor:** retrieval is strictly scoped to the current project. The prompt asks the model to mark unsupported questions as ungrounded; citations are only created from retrieved chunks selected by the model.
- **Persistent context:** recent messages are short-term context; `LearningContext` stores project or user facts useful in later sessions.
- **Safe AI actions:** models only produce schema-validated structured output. Application writes occur in service code, never directly from arbitrary model text.
- **Asynchronous materials:** uploads create a `Job`; the separately-run worker owns parsing, chunk creation, concept extraction, status/failure updates, and recommendation follow-ups.
- **Observability:** AI calls record latency, success/failure, token estimates and estimated cost in `AIUsageLog`; activity and job data feed analytics/admin views.

## Prototype trade-offs

This prototype uses hybrid lexical + Gemini-embedding retrieval scored in memory (not a real vector index — see `src/lib/retrieval/search.ts`); `pdf-parse` does not retain exact page locations; scanned PDFs need an OCR provider. The database queue is intentionally simple for a prototype and should become a managed queue or BullMQ/Redis setup for high throughput.
