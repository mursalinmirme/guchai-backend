import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import jwt from "jsonwebtoken";

// Store active SSE connections mapped by User ID
const clients = new Map<string, Response[]>();

export const handleSSE = (req: AuthRequest, res: Response) => {
  const userId = req.user._id.toString();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected" })}\n\n`);

  if (!clients.has(userId)) {
    clients.set(userId, []);
  }
  clients.get(userId)?.push(res);

  console.log(`[SSE] Client connected for user ${userId}`);

  req.on("close", () => {
    console.log(`[SSE] Client disconnected for user ${userId}`);
    const userClients = clients.get(userId) || [];
    clients.set(userId, userClients.filter(client => client !== res));
    if (clients.get(userId)?.length === 0) {
      clients.delete(userId);
    }
  });
};

export const emitAssistantEvent = (userId: string, eventName: string, payload: any) => {
  const userClients = clients.get(userId.toString());
  if (userClients && userClients.length > 0) {
    const dataString = JSON.stringify(payload);
    userClients.forEach(res => {
      res.write(`event: ${eventName}\ndata: ${dataString}\n\n`);
    });
  }
};
