import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ Create Genre
export const createGenre = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Nama genre wajib diisi.",
      });
    }

    // Cek apakah genre dengan nama sama pernah ada
    const existing = await prisma.genres.findUnique({
      where: { name },
    });

    // Jika ada dan belum dihapus → tolak
    if (existing && existing.deleted_at === null) {
      return res.status(400).json({
        success: false,
        message: "Genre sudah terdaftar.",
      });
    }

    // Jika ada tapi sudah dihapus (soft delete) → restore
    if (existing && existing.deleted_at !== null) {
      const restored = await prisma.genres.update({
        where: { id: existing.id },
        data: {
          deleted_at: null,
          updated_at: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Genre berhasil dibuat. (restore dari soft delete).",
        data: restored,
      });
    }

    // Kalau benar-benar baru → buat dari nol
    const genre = await prisma.genres.create({
      data: {
        name,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Genre berhasil dibuat.",
      data: genre,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
    });
  }
};


// ✅ Get All Genre
export const getAllGenres = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }
    
    const genres = await prisma.genres.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: "desc" },
    });

    return res.json({
      success: true,
      message: "Daftar genre berhasil diambil.",
      data: genres,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
    });
  }
};

// ✅ Get Genre Detail
export const getGenreById = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { genre_id } = req.params;

    const genre = await prisma.genres.findFirst({
        where: { id: genre_id, deleted_at: null },
    });

    if (!genre) {
      return res.status(404).json({
        success: false,
        message: "Genre tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      message: "Detail genre berhasil diambil.",
      data: genre,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
    });
  }
};

// ✅ Update Genre
export const updateGenre = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { genre_id } = req.params;
    const { name } = req.body;

    const genre = await prisma.genres.findUnique({
      where: { id: genre_id },
    });

    if (!genre) {
      return res.status(404).json({
        success: false,
        message: "Genre tidak ditemukan.",
      });
    }

    const updated = await prisma.genres.update({
      where: { id: genre_id },
      data: {
        name: name || genre.name,
        updated_at: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "Genre berhasil diperbarui.",
      data: updated,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
    });
  }
};

// ✅ Soft Delete Genre
export const deleteGenre = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }
    
    const { genre_id } = req.params;

    // Pastikan genre ada
    const genre = await prisma.genres.findUnique({
      where: { id: genre_id },
    });

    if (!genre) {
      return res.status(404).json({
        success: false,
        message: "Genre tidak ditemukan.",
      });
    }

    // Pastikan tidak ada buku yang masih pakai genre ini
    const books = await prisma.books.findMany({
      where: { genre_id },
    });

    if (books.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Genre tidak dapat dihapus karena masih digunakan oleh buku.",
      });
    }

    // Soft delete → update kolom deleted_at
    const deleted = await prisma.genres.update({
      where: { id: genre_id },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });

    return res.json({
      success: true,
      message: "Genre berhasil dihapus (soft delete).",
      data: deleted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
    });
  }
};

