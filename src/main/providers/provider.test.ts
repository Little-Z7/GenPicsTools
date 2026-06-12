import { describe, expect, it } from "vitest";
import { generateWithProvider } from "./index";
import type { GenerationRequest } from "../../shared/types";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

function createRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    provider: {
      format: "openai",
      baseUrl: "https://api.example.test/v1/",
      apiKey: "test-key",
      model: "image-model"
    },
    prompt: "a crisp product render",
    size: "1024x1024",
    count: 1,
    ...overrides
  };
}

describe("provider adapters", () => {
  it("normalizes OpenAI-compatible base64 image responses", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: pngBase64, revised_prompt: "a sharper prompt" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const result = await generateWithProvider(createRequest(), fetchImpl);

    expect(calls[0].input).toBe("https://api.example.test/v1/images/generations");
    expect(calls[0].init?.method).toBe("POST");
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer test-key");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      model: "image-model",
      prompt: "a crisp product render",
      size: "1024x1024",
      n: 1
    });
    expect(result.images).toEqual([
      {
        source: "base64",
        data: pngBase64,
        mimeType: "image/png",
        extension: "png",
        revisedPrompt: "a sharper prompt"
      }
    ]);
  });

  it("normalizes OpenAI-compatible image URL responses", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          data: [{ url: "https://cdn.example.test/image.png" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    const result = await generateWithProvider(createRequest(), fetchImpl);

    expect(result.images).toEqual([
      {
        source: "url",
        url: "https://cdn.example.test/image.png",
        mimeType: "image/png",
        extension: "png"
      }
    ]);
  });

  it("accepts a full OpenAI-compatible image endpoint and bearer-prefixed API key", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: pngBase64 }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    await generateWithProvider(
      createRequest({
        provider: {
          format: "openai",
          baseUrl: "https://api.example.test/v1/images/generations",
          apiKey: "Bearer already-prefixed",
          model: "image-model"
        }
      }),
      fetchImpl
    );

    expect(calls[0].input).toBe("https://api.example.test/v1/images/generations");
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer already-prefixed");
  });

  it("normalizes Gemini inline image responses", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "Done" },
                  { inlineData: { mimeType: "image/png", data: pngBase64 } }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const result = await generateWithProvider(
      createRequest({
        provider: {
          format: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta",
          apiKey: "gemini-key",
          model: "gemini-2.5-flash-image"
        },
        size: "1:1"
      }),
      fetchImpl
    );

    expect(calls[0].input).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
    );
    expect(new Headers(calls[0].init?.headers).get("x-goog-api-key")).toBe("gemini-key");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      contents: [{ parts: [{ text: "a crisp product render" }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });
    expect(result.images).toEqual([
      {
        source: "base64",
        data: pngBase64,
        mimeType: "image/png",
        extension: "png"
      }
    ]);
  });
});
