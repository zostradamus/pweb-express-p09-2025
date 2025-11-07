import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Gantilah dengan secret environment kamu (.env)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Bypass route auth
  const url = req.originalUrl;
if (url.startsWith("/auth") || url.startsWith("/health")) {
  return next();
}

  // Ambil token dari header Authorization
  const authHeader = req.headers.authorization;
  console.log("Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Token tidak ditemukan.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    console.log("Authorization Header:", authHeader);
    console.log("JWT_SECRET:", JWT_SECRET);
    console.log("Token yang akan diverifikasi:", token);

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded; // simpan info user ke request
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
};
