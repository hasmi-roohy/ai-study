# AI Usage and Development Prompts

## AI used in the product

Groq's `openai/gpt-oss-120b` is used at runtime for Tutor responses, concept extraction, quiz generation, open-ended answer grading, recommendations, and evaluation. Calls go through `src/lib/ai/provider.ts`, which validates structured outputs with Zod and logs usage.

## AI used during development

Codex (OpenAI) was used as an engineering assistant for reviewing the PRD, implementing missing Space and Project user interfaces, restoring Tutor continuity, and preparing project documentation/configuration. It is not called by the running product.

## Material development prompts in this repository session

The following is the complete substantive development direction supplied for this implementation session:

> i have built some a little bit stuff can u please build all the remaining things present in the document provided,if u have any questions plz ask me

> first access my folder ai-study-companion make changes in it

> yeah proceed do it

The PRD supplied with the repository was used as the product specification. Product prompts used at runtime are versioned in `src/lib/ai/prompts/tutor.ts` and `src/lib/ai/prompts/quiz.ts`; the concept and recommendation prompts live next to their background handlers. This record is intentionally limited to prompts visible in this repository session; it does not claim to reconstruct prompts from work performed before this session.
