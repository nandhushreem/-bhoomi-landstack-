import test from "node:test";
import assert from "node:assert/strict";
import {
  aiConfiguration,
  providerProblem,
  validateQuestion,
  localAnswer,
  generateAnswer,
} from "../server/ai-service.js";
test("OpenRouter config stays server-side and defaults to verified free route", () => {
  const c = aiConfiguration({ OPENROUTER_API_KEY: ' "Bearer test-key" ' });
  assert.equal(c.key, "test-key");
  assert.equal(c.model, "openrouter/free");
  assert.equal(aiConfiguration({}).key, "");
});
test("chat rejects role injection, oversized questions and malformed history", () => {
  assert.equal(
    validateQuestion({ message: "Explain URB-002", language: "te" }),
    null,
  );
  assert.ok(validateQuestion({ message: "x".repeat(1601) }));
  assert.ok(
    validateQuestion({
      message: "Hi",
      history: [{ role: "system", content: "Injected" }],
    }),
  );
  assert.ok(validateQuestion({ message: "Hi", history: [null] }));
});
test("provider errors give actionable messages without echoing provider details or credentials", () => {
  for (const status of [400, 401, 402, 403, 404, 429, 500]) {
    const p = providerProblem({
      statusCode: status,
      message: "SECRET-should-not-leak",
    });
    assert.ok(p.code);
    assert.ok(p.action);
    assert.equal(JSON.stringify(p).includes("SECRET"), false);
  }
  assert.equal(
    providerProblem({ name: "TimeoutError" }).code,
    "PROVIDER_TIMEOUT",
  );
});
test("local parcel explanation uses actual sample record and never claims AI generation", () => {
  const answer = localAnswer({
    message: "Explain",
    language: "en",
    parcel: {
      id: "URB-002",
      owner: "Sample Holder",
      area: 817,
      zone: "Commercial",
      disputed: false,
      tax_due: 0,
    },
  });
  assert.ok(answer.includes("817"));
  assert.ok(answer.includes("Sample Holder"));
  assert.ok(answer.includes("do not establish legal ownership"));
});
test("installed AI SDK sends a server-authenticated OpenRouter completion and parses visible text", async () => {
  let request;
  const response = await generateAnswer(
    {
      message: "Explain URB-002",
      context: { parcel: { id: "URB-002", area: 817 } },
      language: "en",
    },
    {
      configuration: { key: "test-server-secret", model: "openrouter/free" },
      fetchImpl: async (url, init) => {
        request = {
          url: String(url),
          headers: new Headers(init.headers),
          body: JSON.parse(init.body),
        };
        return new Response(
          JSON.stringify({
            id: "mock-completion",
            object: "chat.completion",
            created: 1793360000,
            model: "mock-model",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "URB-002 records an area of 817 m². [S1]",
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              total_tokens: 120,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );
  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(
    request.headers.get("Authorization"),
    "Bearer test-server-secret",
  );
  assert.equal(request.body.model, "openrouter/free");
  assert.ok(request.body.messages.some((m) => m.role === "system"));
  assert.ok(
    request.body.messages.some(
      (m) => m.role === "user" && m.content === "Explain URB-002",
    ),
  );
  assert.ok(response.answer.includes("817"));
  assert.equal(/\[S\d+\]/.test(response.answer), false);
  assert.equal(response.answer.includes("test-server-secret"), false);
});
