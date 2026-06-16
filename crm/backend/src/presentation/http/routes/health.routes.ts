import { Router } from "express";
import { prisma } from "../../../config/prisma";

export const healthRoutes = Router();

healthRoutes.get("/health", (_req, res) => {
  res.status(200).json({
    data: {
      status: "ok"
    },
    meta: null,
    error: null
  });
});

healthRoutes.get("/ready", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      data: {
        database: "ok",
        status: "ready"
      },
      meta: null,
      error: null
    });
  } catch (error) {
    next(error);
  }
});
