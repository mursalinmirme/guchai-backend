import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import { createAIProvider, Message } from "../services/ai/AIProvider";
import { TOOL_DEFINITIONS, executeTool } from "../services/ai/tools";
import { buildSystemPrompt } from "../services/ai/systemPrompt";
import { RobotMemory } from "../models/RobotMemory";

// Maximum agentic loop iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 6;

interface ChatRequest {
  messages: Message[];
}

// @route   POST /api/robot/chat
export const chat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ message: "messages array is required." });
      return;
    }

    // Sanitize messages — only allow valid roles, no system messages from client
    const sanitizedMessages: Message[] = messages
      .filter((m) => ["user", "assistant", "tool"].includes(m.role))
      .map((m) => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.tool_call_id,
        tool_calls: m.tool_calls,
        name: m.name,
      }));

    const provider = createAIProvider();
    
    // Inject memories into context
    const memories = await RobotMemory.find({ user_id: req.user._id }).sort({ created_at: -1 });

    const systemPrompt = buildSystemPrompt({
      today: new Date().toISOString().split("T")[0],
      timezone: req.user.preferences?.timezone || "UTC",
      userEmail: req.user?.email,
      memories: memories.map(m => m.toJSON()),
    });

    // Agentic loop: let the model call tools iteratively
    const conversationMessages: Message[] = [...sanitizedMessages];
    const toolExecutions: Array<{ tool: string; args: any; result: any; label: string }> = [];

    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const aiResponse = await provider.generateWithTools(
        conversationMessages,
        TOOL_DEFINITIONS,
        systemPrompt
      );

      // If no tool calls, we have a final text response
      if (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0) {
        res.json({
          reply: aiResponse.content || "I'm not sure how to respond to that.",
          toolExecutions,
        });
        return;
      }

      // Add assistant's tool-calling message to the conversation
      conversationMessages.push({
        role: "assistant",
        content: aiResponse.content,
        tool_calls: aiResponse.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of aiResponse.tool_calls) {
        const toolName = toolCall.function.name;
        let args: Record<string, any> = {};

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        // Generate a human-readable label for the UI
        const label = getToolLabel(toolName, args);

        const result = await executeTool(toolName, args, req.user._id);

        toolExecutions.push({ tool: toolName, args, result, label });

        // Add tool result to conversation
        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
          name: toolName,
        });
      }
    }

    // If we exhausted iterations without a text response
    res.json({
      reply: "I completed the requested actions. Let me know if you need anything else.",
      toolExecutions,
    });
  } catch (error: any) {
    console.error("[Robot]", error);

    // Handle specific errors without exposing internals
    if (error.message?.includes("GROQ_API_KEY")) {
      res.status(503).json({ message: "AI service is not configured. Please add GROQ_API_KEY to the .env file." });
      return;
    }

    if (error.status === 401) {
      res.status(401).json({ message: "Invalid AI Provider API key. Please check your .env file." });
      return;
    }

    if (error.status === 429 || error.message?.includes("rate limit")) {
      res.status(429).json({ message: "AI service is currently busy. Please try again in a moment." });
      return;
    }

    if (error.status >= 400 && error.status < 500) {
      const apiMsg = error.error?.error?.message || error.message;
      res.status(400).json({ message: `AI Provider Error: ${apiMsg || "I couldn't understand that request."}` });
      return;
    }

    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// @route   GET /api/robot/status
export const getStatus = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    provider: process.env.AI_PROVIDER || "groq",
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    status: "operational",
  });
};

// ─────────────────────────────────────────────────────────────
// Memory Management Endpoints (for UI)
// ─────────────────────────────────────────────────────────────

export const getMemories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const memories = await RobotMemory.find({ user_id: req.user._id }).sort({ created_at: -1 });
    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMemory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mem = await RobotMemory.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!mem) {
      res.status(404).json({ message: "Memory not found" });
      return;
    }
    res.json({ message: "Memory deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const clearMemories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await RobotMemory.deleteMany({ user_id: req.user._id });
    res.json({ message: "All memories cleared" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getToolLabel(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case "getTasks":
      return args.filter ? `Fetching ${args.filter} tasks…` : "Fetching tasks…";
    case "getTask":
      return "Looking up task…";
    case "createTask":
      return `Creating task "${args.title}"…`;
    case "updateTask":
      return "Updating task…";
    case "completeTask":
      return "Marking task complete…";
    case "deleteTask":
      return "Deleting task…";
    case "getTaskAnalytics":
      return `Analyzing ${args.period?.replace(/_/g, " ")} productivity…`;
    case "getActivityHistory":
      return "Loading activity history…";
    default:
      return "Processing…";
  }
}
