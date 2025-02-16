import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { businesses, knowledgeBase } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Business profile routes
  app.get("/api/business/:id", async (req, res) => {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, parseInt(req.params.id)));

    if (!business) {
      return res.status(404).send("Business not found");
    }
    res.json(business);
  });

  app.post("/api/business", async (req, res) => {
    const [business] = await db
      .insert(businesses)
      .values(req.body)
      .returning();
    res.status(201).json(business);
  });

  // Knowledge base routes
  app.get("/api/knowledge-base", async (req, res) => {
    const entries = await db
      .select()
      .from(knowledgeBase);
    res.json(entries);
  });

  app.post("/api/knowledge-base", async (req, res) => {
    const [entry] = await db
      .insert(knowledgeBase)
      .values(req.body)
      .returning();
    res.status(201).json(entry);
  });

  const httpServer = createServer(app);
  return httpServer;
}