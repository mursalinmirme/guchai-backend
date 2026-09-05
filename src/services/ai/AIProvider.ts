import Groq from "groq-sdk";

// ─────────────────────────────────────────────────────────────
// Type definitions for the AI provider abstraction layer
// ─────────────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface AIResponse {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: string;
}

// ─────────────────────────────────────────────────────────────
// Abstract interface every provider must implement
// ─────────────────────────────────────────────────────────────

export interface AIProvider {
  generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<AIResponse>;

  getProviderName(): string;
  getModel(): string;
}

// ─────────────────────────────────────────────────────────────
// Groq Provider Implementation
// ─────────────────────────────────────────────────────────────

export class GroqProvider implements AIProvider {
  private client: Groq;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in environment variables.");
    this.client = new Groq({ apiKey });
    this.model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  }

  getProviderName(): string {
    return "groq";
  }

  getModel(): string {
    return this.model;
  }

  async generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<AIResponse> {
    const allMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: allMessages,
      tools: tools as any,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1024,
    });

    const choice = response.choices[0];
    const msg = choice.message;

    return {
      content: msg.content ?? null,
      tool_calls: msg.tool_calls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      finish_reason: choice.finish_reason,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Factory: returns the configured provider
// ─────────────────────────────────────────────────────────────

export function createAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || "groq";
  switch (provider) {
    case "groq":
      return new GroqProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER: "${provider}". Supported: groq`);
  }
}
