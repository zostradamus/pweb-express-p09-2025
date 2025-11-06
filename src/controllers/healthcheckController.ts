// src/controllers/healthController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Tes koneksi ke database
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      message: "Server and database are healthy.",
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
};
