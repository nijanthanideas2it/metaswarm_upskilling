import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { healthRoutes } from "./presentation/http/routes/health.routes";

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", healthRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      data: null,
      meta: null,
      error: {
        code: "NOT_FOUND",
        message: "Route not found"
      }
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const message = env.NODE_ENV === "production" ? "Internal server error" : String(error.message ?? error);
    res.status(500).json({
      data: null,
      meta: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message
      }
    });
  };

  app.use(errorHandler);

  return app;
}
