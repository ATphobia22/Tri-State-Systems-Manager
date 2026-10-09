# OpenAI provider adapter

Minimal Responses API text adapter with bounded timeout, caller cancellation, explicit model selection, input validation, and no credential logging. Requires `OPENAI_API_KEY`. Configure an approved model and policy at deployment time. This adapter does not itself perform authorization, quota enforcement, or evidence validation; callers must apply those controls before dispatch.
