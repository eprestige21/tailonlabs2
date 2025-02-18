import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { deploymentManager } from "./deploy";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting server initialization...");

    // Test database connection first
    try {
      log("Testing database connection...");
      const result = await db.query.users.findFirst();
      log("Database connection successful");
    } catch (error) {
      log(`Database connection failed: ${error}`);
      process.exit(1);
    }

    // Temporarily disable deployment manager
    log("Skipping deployment manager initialization for debugging");
    // const deployInit = await deploymentManager.initialize();
    // if (!deployInit.success) {
    //   log(`Failed to initialize deployment: ${deployInit.error}`);
    //   process.exit(1);
    // }
    // log("Deployment manager initialized successfully");

    log("Registering routes...");
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      log(`Error occurred: ${err.message}`);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Setup Vite or static serving based on environment
    log("Setting up server environment...");
    if (app.get("env") === "development") {
      await setupVite(app, server);
      log("Vite development server setup complete");
    } else {
      serveStatic(app);
      log("Static file serving setup complete");
    }

    // Start the server
    const PORT = 5000;
    log(`Attempting to start server on port ${PORT}...`);
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started successfully on port ${PORT}`);
    });
  } catch (error) {
    log(`Critical error during server startup: ${error}`);
    process.exit(1);
  }
})();