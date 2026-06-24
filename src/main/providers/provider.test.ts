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

  it("accepts a full OpenAI-compatible endpoint and bearer-prefixed API key", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
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

  it("uses OpenAI-compatible image edits when reference images are provided", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    await generateWithProvider(
      createRequest({
        referenceImages: [
          {
            id: "ref",
            filePath: "C:/tmp/ref.png",
            fileUrl: "file:///C:/tmp/ref.png",
            originalName: "ref.png",
            mimeType: "image/png",
            sizeBytes: 16
          }
        ]
      }),
      fetchImpl,
      async () => Buffer.from("reference-bytes")
    );

    const form = calls[0].init?.body as FormData;
    expect(calls[0].input).toBe("https://api.example.test/v1/images/edits");
    expect(form.get("model")).toBe("image-model");
    expect(form.get("prompt")).toBe("a crisp product render");
    expect(form.get("size")).toBe("1024x1024");
    expect(form.get("n")).toBe("1");
    expect(form.get("image")).toBeInstanceOf(Blob);
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

  it("sends Gemini reference images as inline data parts", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: pngBase64 } }] } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    await generateWithProvider(
      createRequest({
        provider: {
          format: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta",
          apiKey: "gemini-key",
          model: "gemini-2.5-flash-image"
        },
        size: "16:9",
        referenceImages: [
          {
            id: "ref",
            filePath: "C:/tmp/ref.webp",
            fileUrl: "file:///C:/tmp/ref.webp",
            originalName: "ref.webp",
            mimeType: "image/webp",
            sizeBytes: 16
          }
        ]
      }),
      fetchImpl,
      async () => Buffer.from("reference-bytes")
    );

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.contents[0].parts).toEqual([
      { text: "a crisp product render" },
      {
        inlineData: {
          mimeType: "image/webp",
          data: Buffer.from("reference-bytes").toString("base64")
        }
      }
    ]);
    expect(body.generationConfig.responseFormat.image.aspectRatio).toBe("16:9");
  });

  it("runs the fixed SeeThrough workflow through RunningHub upload, submit, and query", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });

      if (String(input).endsWith("/media/upload/binary")) {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer rh-key");
        expect(init?.body).toBeInstanceOf(FormData);
        expect((init?.body as FormData).get("file")).toBeInstanceOf(Blob);
        return new Response(
          JSON.stringify({
            code: 0,
            message: "success",
            data: {
              type: "image",
              download_url: "https://cdn.runninghub.test/input.png",
              fileName: "openapi/uploaded-source.png",
              size: "128"
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (String(input).endsWith("/run/ai-app/2040054307541749762")) {
        return new Response(
          JSON.stringify({
            taskId: "rh-task-1",
            status: "QUEUED",
            errorCode: "",
            errorMessage: "",
            results: null
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (String(input).endsWith("/query")) {
        return new Response(
          JSON.stringify({
            taskId: "rh-task-1",
            status: "SUCCESS",
            errorCode: "",
            errorMessage: "",
            results: [
              {
                url: "https://cdn.runninghub.test/output/see-through.png",
                nodeId: "2",
                outputType: "png",
                text: null
              },
              {
                url: "https://cdn.runninghub.test/output/layers.zip",
                nodeId: "20",
                outputType: "zip",
                text: null
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected request ${input}`);
    };
    const statuses: string[] = [];

    const result = await generateWithProvider(
      createRequest({
        provider: {
          format: "workflow",
          baseUrl: "https://ignored.example.test",
          apiKey: "rh-key",
          model: "seethrough"
        },
        prompt: "SeeThrough分层",
        size: "workflow",
        referenceImages: [
          {
            id: "ref",
            filePath: "C:/tmp/source.png",
            fileUrl: "file:///C:/tmp/source.png",
            originalName: "source.png",
            mimeType: "image/png",
            sizeBytes: 128
          }
        ]
      }),
      fetchImpl,
      async () => Buffer.from("source-bytes"),
      (status) => statuses.push(status)
    );

    expect(calls.map((call) => call.input)).toEqual([
      "https://www.runninghub.cn/openapi/v2/media/upload/binary",
      "https://www.runninghub.cn/openapi/v2/run/ai-app/2040054307541749762",
      "https://www.runninghub.cn/openapi/v2/query"
    ]);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      nodeInfoList: [
        {
          nodeId: "1",
          fieldName: "image",
          fieldValue: "openapi/uploaded-source.png",
          description: "上传图片image"
        }
      ],
      instanceType: "default",
      usePersonalQueue: "false"
    });
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ taskId: "rh-task-1" });
    expect(result.images).toEqual([
      {
        source: "url",
        url: "https://cdn.runninghub.test/output/see-through.png",
        mimeType: "image/png",
        extension: "png"
      },
      {
        source: "url",
        url: "https://cdn.runninghub.test/output/layers.zip",
        mimeType: "application/zip",
        extension: "zip"
      }
    ]);
    expect(statuses).toEqual(["queued"]);
  });

  it("runs the SeeThrough v1 workflow through the second RunningHub app", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });

      if (String(input).endsWith("/media/upload/binary")) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: "success",
            data: {
              fileName: "openapi/uploaded-source.jpg"
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (String(input).endsWith("/run/ai-app/2039976277867761666")) {
        return new Response(
          JSON.stringify({
            taskId: "rh-task-v1",
            status: "RUNNING",
            errorCode: "",
            errorMessage: "",
            results: null
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (String(input).endsWith("/query")) {
        return new Response(
          JSON.stringify({
            taskId: "rh-task-v1",
            status: "SUCCESS",
            results: [
              {
                url: "https://cdn.runninghub.test/output/seethrough-v1.png",
                nodeId: "2",
                outputType: "png",
                text: null
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected request ${input}`);
    };

    const result = await generateWithProvider(
      createRequest({
        provider: {
          format: "workflow",
          baseUrl: "https://ignored.example.test",
          apiKey: "rh-key",
          model: "seethroughv1"
        },
        prompt: "seethroughv1",
        size: "workflow",
        referenceImages: [
          {
            id: "ref",
            filePath: "C:/tmp/source.jpg",
            fileUrl: "file:///C:/tmp/source.jpg",
            originalName: "source.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 128
          }
        ]
      }),
      fetchImpl,
      async () => Buffer.from("source-bytes")
    );

    expect(calls.map((call) => call.input)).toEqual([
      "https://www.runninghub.cn/openapi/v2/media/upload/binary",
      "https://www.runninghub.cn/openapi/v2/run/ai-app/2039976277867761666",
      "https://www.runninghub.cn/openapi/v2/query"
    ]);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      nodeInfoList: [
        {
          nodeId: "1",
          fieldName: "image",
          fieldValue: "openapi/uploaded-source.jpg",
          description: "image"
        }
      ],
      instanceType: "default",
      usePersonalQueue: "false"
    });
    expect(result.images).toEqual([
      {
        source: "url",
        url: "https://cdn.runninghub.test/output/seethrough-v1.png",
        mimeType: "image/png",
        extension: "png"
      }
    ]);
  });

  it("runs the SeeThrough8673 workflow through the third RunningHub app", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });

      if (String(input).endsWith("/media/upload/binary")) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: "success",
            data: {
              fileName: "pasted/ac59927fc26830fbf3076b2cef5a0961773dfaa5c98df91c1d6cde4c701f133c.png"
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (String(input).endsWith("/run/ai-app/2042526067000348673")) {
        return new Response(
          JSON.stringify({
            taskId: "rh-task-8673",
            status: "RUNNING",
            errorCode: "",
            errorMessage: "",
            results: null
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (String(input).endsWith("/query")) {
        return new Response(
          JSON.stringify({
            taskId: "rh-task-8673",
            status: "SUCCESS",
            results: [
              {
                url: "https://cdn.runninghub.test/output/seethrough-8673.png",
                nodeId: "2",
                outputType: "png",
                text: null
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected request ${input}`);
    };

    const result = await generateWithProvider(
      createRequest({
        provider: {
          format: "workflow",
          baseUrl: "https://ignored.example.test",
          apiKey: "rh-key",
          model: "seethrough8673"
        },
        prompt: "SeeThrough8673",
        size: "workflow",
        referenceImages: [
          {
            id: "ref",
            filePath: "C:/tmp/source.png",
            fileUrl: "file:///C:/tmp/source.png",
            originalName: "source.png",
            mimeType: "image/png",
            sizeBytes: 128
          }
        ]
      }),
      fetchImpl,
      async () => Buffer.from("source-bytes")
    );

    expect(calls.map((call) => call.input)).toEqual([
      "https://www.runninghub.cn/openapi/v2/media/upload/binary",
      "https://www.runninghub.cn/openapi/v2/run/ai-app/2042526067000348673",
      "https://www.runninghub.cn/openapi/v2/query"
    ]);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      nodeInfoList: [
        {
          nodeId: "1",
          fieldName: "image",
          fieldValue: "pasted/ac59927fc26830fbf3076b2cef5a0961773dfaa5c98df91c1d6cde4c701f133c.png",
          description: "上传图片"
        }
      ],
      instanceType: "default",
      usePersonalQueue: "false"
    });
    expect(result.images).toEqual([
      {
        source: "url",
        url: "https://cdn.runninghub.test/output/seethrough-8673.png",
        mimeType: "image/png",
        extension: "png"
      }
    ]);
  });

  it("rejects SeeThrough workflow tasks without a reference image", async () => {
    await expect(
      generateWithProvider(
        createRequest({
        provider: {
            format: "workflow",
            baseUrl: "https://ignored.example.test",
            apiKey: "rh-key",
            model: "seethrough"
          },
          prompt: "SeeThrough分层",
          size: "workflow",
          referenceImages: []
        })
      )
    ).rejects.toThrow("SeeThrough分层 requires one uploaded image.");
  });
});
