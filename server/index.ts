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
  log(`${req.method} ${req.url} - Started`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
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

    log("Registering routes...");
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      log(`Error occurred: ${err.message}`);
      console.error(err);
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
    const PORT = Number(process.env.PORT) || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started successfully on port ${PORT}`);
      log(`Server URL: http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    log(`Critical error during server startup: ${error}`);
    console.error(error);
    process.exit(1);
  }
})();