/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
// import { headers } from "next/headers"; // Removed unused import
import { InferenceClient } from "@huggingface/inference";
// import MY_TOKEN_KEY from "@/lib/get-cookie-name"; // Removed unused import
import {
  INITIAL_SYSTEM_PROMPT,
  FOLLOW_UP_SYSTEM_PROMPT,
  SEARCH_START,
  DIVIDER,
  REPLACE_END,
} from "@/lib/prompts";
import { MODELS, PROVIDERS } from "@/lib/providers";

export async function POST(request: NextRequest) {
  // const authHeaders = await headers(); // Removed unused variable
  // const userToken = request.cookies.get(MY_TOKEN_KEY())?.value; // Removed unused variable

  const body = await request.json();
  const { prompt, provider, model, redesignMarkdown, html, userHfToken } = body;

  if (!model || (!prompt && !redesignMarkdown)) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const selectedModel = MODELS.find(
    (m) => m.value === model || m.label === model
  );
  if (!selectedModel) {
    return NextResponse.json(
      { ok: false, error: "Invalid model selected" },
      { status: 400 }
    );
  }

  if (!selectedModel.providers.includes(provider) && provider !== "auto") {
    return NextResponse.json(
      {
        ok: false,
        error: `The selected model does not support the ${provider} provider.`,
        openSelectProvider: true,
      },
      { status: 400 }
    );
  }

  const token = userHfToken; // Use user's token from client-side storage
  const billTo: string | null = null;

  // If no user token provided, show error
  if (!token || token.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please enter your Hugging Face token in the HF Token button to use AI features.",
      },
      { status: 400 }
    );
  }

  // Validate token format
  if (!token.startsWith("hf_")) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid Hugging Face token format. Token should start with 'hf_'.",
      },
      { status: 400 }
    );
  }

  const DEFAULT_PROVIDER = PROVIDERS.novita;
  const selectedProvider =
    provider === "auto"
      ? PROVIDERS[selectedModel.autoProvider as keyof typeof PROVIDERS]
      : PROVIDERS[provider as keyof typeof PROVIDERS] ?? DEFAULT_PROVIDER;

  try {
    // Create a stream response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the response
    const response = new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    (async () => {
      let completeResponse = "";
      try {
        const client = new InferenceClient(token);
        const chatCompletion = client.chatCompletionStream(
          {
            model: selectedModel.value,
            provider: selectedProvider.id as any,
            messages: [
              {
                role: "system",
                content: INITIAL_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: redesignMarkdown
                  ? `Here is my current design as a markdown:\n\n${redesignMarkdown}\n\nNow, please create a new design based on this markdown.`
                  : html
                  ? `Here is my current HTML code:\n\n\`\`\`html\n${html}\n\`\`\`\n\nNow, please create a new design based on this HTML.`
                  : prompt,
              },
            ],
            max_tokens: selectedProvider.max_tokens,
          },
          billTo ? { billTo } : {}
        );

        while (true) {
          const { done, value } = await chatCompletion.next();
          if (done) {
            break;
          }

          const chunk = value.choices[0]?.delta?.content;
          if (chunk) {
            let newChunk = chunk;
            if (!selectedModel?.isThinker) {
              if (provider !== "sambanova") {
                await writer.write(encoder.encode(chunk));
                completeResponse += chunk;

                if (completeResponse.includes("</html>")) {
                  break;
                }
              } else {
                if (chunk.includes("</html>")) {
                  newChunk = newChunk.replace(/<\/html>[\s\S]*/, "</html>");
                }
                completeResponse += newChunk;
                await writer.write(encoder.encode(newChunk));
                if (newChunk.includes("</html>")) {
                  break;
                }
              }
            } else {
              const lastThinkTagIndex =
                completeResponse.lastIndexOf("</think>");
              completeResponse += newChunk;
              await writer.write(encoder.encode(newChunk));
              if (lastThinkTagIndex !== -1) {
                const afterLastThinkTag = completeResponse.slice(
                  lastThinkTagIndex + "</think>".length
                );
                if (afterLastThinkTag.includes("</html>")) {
                  break;
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.error("AI Provider Error:", error);
        
        // Check for specific error types
        if (error.message?.includes("exceeded your monthly included credits")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openProModal: true,
                message: error.message,
              })
            )
          );
        } else if (error.message?.includes("HTTP error") || error.message?.includes("Failed to perform inference")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openSelectProvider: true,
                message: "The AI provider is currently experiencing issues. Please try switching to a different provider in Settings, or try again in a few minutes.",
              })
            )
          );
        } else if (error.message?.includes("rate limit") || error.message?.includes("too many requests")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                message: "Rate limit exceeded. Please wait a moment and try again, or switch to a different AI provider.",
              })
            )
          );
        } else {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                message:
                  error.message ||
                  "An error occurred while processing your request. Please try again or switch AI providers.",
              })
            )
          );
        }
      } finally {
        await writer?.close();
      }
    })();

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        openSelectProvider: true,
        message:
          error?.message || "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // const authHeaders = await headers(); // Removed unused variable
  // const userToken = request.cookies.get(MY_TOKEN_KEY())?.value; // Removed unused variable

  const body = await request.json();
  const { prompt, html, previousPrompt, provider, selectedElementHtml, userHfToken } = body;

  if (!prompt || !html) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const selectedModel = MODELS[0];

  const token = userHfToken; // Use user's token from client-side storage
  const billTo: string | null = null;

  // If no user token provided, show error
  if (!token || token.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please enter your Hugging Face token in the HF Token button to use AI features.",
      },
      { status: 400 }
    );
  }

  // Validate token format
  if (!token.startsWith("hf_")) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid Hugging Face token format. Token should start with 'hf_'.",
      },
      { status: 400 }
    );
  }

  const client = new InferenceClient(token);

  const DEFAULT_PROVIDER = PROVIDERS.novita;
  const selectedProvider =
    provider === "auto"
      ? PROVIDERS[selectedModel.autoProvider as keyof typeof PROVIDERS]
      : PROVIDERS[provider as keyof typeof PROVIDERS] ?? DEFAULT_PROVIDER;

  try {
    const response = await client.chatCompletion(
      {
        model: selectedModel.value,
        provider: selectedProvider.id as any,
        messages: [
          {
            role: "system",
            content: FOLLOW_UP_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: previousPrompt
              ? previousPrompt
              : "You are modifying the HTML file based on the user's request.",
          },
          {
            role: "assistant",

            content: `The current code is: \n\`\`\`html\n${html}\n\`\`\` ${
              selectedElementHtml
                ? `\n\nYou have to update ONLY the following element, NOTHING ELSE: \n\n\`\`\`html\n${selectedElementHtml}\n\`\`\``
                : ""
            }`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        ...(selectedProvider.id !== "sambanova"
          ? {
              max_tokens: selectedProvider.max_tokens,
            }
          : {}),
      },
      billTo ? { billTo } : {}
    );

    const chunk = response.choices[0]?.message?.content;
    if (!chunk) {
      return NextResponse.json(
        { ok: false, message: "No content returned from the model" },
        { status: 400 }
      );
    }

    if (chunk) {
      const updatedLines: number[][] = [];
      let newHtml = html;
      let position = 0;
      let moreBlocks = true;

      while (moreBlocks) {
        const searchStartIndex = chunk.indexOf(SEARCH_START, position);
        if (searchStartIndex === -1) {
          moreBlocks = false;
          continue;
        }

        const dividerIndex = chunk.indexOf(DIVIDER, searchStartIndex);
        if (dividerIndex === -1) {
          moreBlocks = false;
          continue;
        }

        const replaceEndIndex = chunk.indexOf(REPLACE_END, dividerIndex);
        if (replaceEndIndex === -1) {
          moreBlocks = false;
          continue;
        }

        const searchBlock = chunk.substring(
          searchStartIndex + SEARCH_START.length,
          dividerIndex
        );
        const replaceBlock = chunk.substring(
          dividerIndex + DIVIDER.length,
          replaceEndIndex
        );

        if (searchBlock.trim() === "") {
          newHtml = `${replaceBlock}\n${newHtml}`;
          updatedLines.push([1, replaceBlock.split("\n").length]);
        } else {
          const blockPosition = newHtml.indexOf(searchBlock);
          if (blockPosition !== -1) {
            const beforeText = newHtml.substring(0, blockPosition);
            const startLineNumber = beforeText.split("\n").length;
            const replaceLines = replaceBlock.split("\n").length;
            const endLineNumber = startLineNumber + replaceLines - 1;

            updatedLines.push([startLineNumber, endLineNumber]);
            newHtml = newHtml.replace(searchBlock, replaceBlock);
          }
        }

        position = replaceEndIndex + REPLACE_END.length;
      }

      return NextResponse.json({
        ok: true,
        html: newHtml,
        updatedLines,
      });
    } else {
      return NextResponse.json(
        { ok: false, message: "No content returned from the model" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("AI Provider Error (Follow-up):", error);
    
    if (error.message?.includes("exceeded your monthly included credits")) {
      return NextResponse.json(
        {
          ok: false,
          openProModal: true,
          message: error.message,
        },
        { status: 402 }
      );
    } else if (error.message?.includes("HTTP error") || error.message?.includes("Failed to perform inference")) {
      return NextResponse.json(
        {
          ok: false,
          openSelectProvider: true,
          message: "The AI provider is currently experiencing issues. Please try switching to a different provider in Settings, or try again in a few minutes.",
        },
        { status: 503 }
      );
    } else if (error.message?.includes("rate limit") || error.message?.includes("too many requests")) {
      return NextResponse.json(
        {
          ok: false,
          message: "Rate limit exceeded. Please wait a moment and try again, or switch to a different AI provider.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        openSelectProvider: true,
        message:
          error.message || "An error occurred while processing your request. Please try again or switch AI providers.",
      },
      { status: 500 }
    );
  }
}
