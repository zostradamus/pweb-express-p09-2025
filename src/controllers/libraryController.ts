import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// ====== CREATE (auto-restore jika soft-deleted) ======
export const createBook = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const {
      title,
      writer,
      publisher,
      description,
      publication_year,
      price,
      stock_quantity,
      genre_id,
    } = req.body;

    // 🔹 Validasi field wajib
    if (
      !title ||
      !writer ||
      !publisher ||
      publication_year === undefined ||
      price === undefined ||
      stock_quantity === undefined ||
      !genre_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Field title, writer, publisher, publication_year, price, stock_quantity, dan genre_id wajib diisi.",
      });
    }

    // 🔹 Validasi tipe number
    const pubYear = Number(publication_year);
    const bookPrice = Number(price);
    const stockQty = Number(stock_quantity);

    if (Number.isNaN(pubYear) || Number.isNaN(bookPrice) || Number.isNaN(stockQty)) {
      return res.status(400).json({
        success: false,
        message:
          "publication_year, price, dan stock_quantity harus berupa number.",
      });
    }

    // 🔹 Validasi harga dan stok tidak boleh minus & stok harus bilangan bulat
if (bookPrice < 0) {
  return res.status(400).json({
    success: false,
    message: "price tidak boleh bernilai negatif.",
  });
}

if (stockQty < 0 || !Number.isInteger(stockQty)) {
  return res.status(400).json({
    success: false,
    message: "stock_quantity harus bilangan bulat dan tidak boleh negatif.",
  });
}

    // 🔹 Validasi tahun
    const thisYear = new Date().getFullYear();
    if (pubYear < 0 || pubYear > thisYear + 1) {
      return res.status(400).json({
        success: false,
        message: "publication_year tidak valid.",
      });
    }

    // 🔹 Validasi genre_id
    const genre = await prisma.genres.findUnique({ where: { id: genre_id } });
    if (!genre) {
      return res
        .status(404)
        .json({ success: false, message: "Genre tidak ditemukan." });
    }

    // 🔹 Cek apakah ada buku aktif dengan judul yang sama
    const existingActive = await prisma.books.findFirst({
      where: { title, deleted_at: null },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: "Buku dengan judul ini sudah ada (aktif).",
      });
    }

    // 🔹 Cek apakah ada buku yang pernah dihapus (soft delete)
    const existingDeleted = await prisma.books.findFirst({
      where: { title, NOT: { deleted_at: null } },
    });

    const now = new Date();

    // Jika ada yang sudah dihapus → restore & update
    if (existingDeleted) {
      const restoredBook = await prisma.books.update({
        where: { id: existingDeleted.id },
        data: {
          deleted_at: null,
          writer,
          publisher,
          description: description || null,
          publication_year: pubYear,
          price: bookPrice,
          stock_quantity: stockQty,
          genre_id,
          updated_at: now,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Buku berhasil ditambahkan kembali.",
        data: restoredBook,
      });
    }

    // 🔹 Kalau belum ada sama sekali → buat baru
    const newBook = await prisma.books.create({
      data: {
        title,
        writer,
        publisher,
        description: description || null,
        publication_year: pubYear,
        price: bookPrice,
        stock_quantity: stockQty,
        genre_id,
        created_at: now,
        updated_at: now,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Buku berhasil ditambahkan.",
      data: newBook,
    });
  } catch (err: any) {
    // 🔹 Handle Prisma error code
    if (err?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Data sudah ada (melanggar unique constraint).",
      });
    }
    if (err?.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Relasi tidak valid (cek genre_id).",
      });
    }

    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server." });
  }
};


// ====== GET ALL (filter + pagination + sorting) ======
export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const {
      page = "1",
      limit = "10",
      search,                 // cari di title / writer / publisher
      minPrice,
      maxPrice,
      year,                   // publication_year
      sortBy = "created_at",  // created_at | title | price | publication_year | stock_quantity
      sortOrder = "desc",     // asc | desc
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const yearNum = year ? Number(year) : undefined;
    const minPriceNum = minPrice ? Number(minPrice) : undefined;
    const maxPriceNum = maxPrice ? Number(maxPrice) : undefined;

    // where diketik pakai Prisma supaya aman
    const where: Prisma.booksWhereInput = {
      deleted_at: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { writer: { contains: search, mode: "insensitive" } },
              { publisher: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(yearNum !== undefined ? { publication_year: yearNum } : {}),
      ...(minPriceNum !== undefined || maxPriceNum !== undefined
        ? {
            price: {
              ...(minPriceNum !== undefined ? { gte: minPriceNum } : {}),
              ...(maxPriceNum !== undefined ? { lte: maxPriceNum } : {}),
            },
          }
        : {}),
    };

    const validSortFields = new Set<keyof Prisma.booksOrderByWithRelationInput>([
      "created_at",
      "title",
      "price",
      "publication_year",
      "stock_quantity",
    ]);

    // default orderBy
    let orderBy: Prisma.booksOrderByWithRelationInput = { created_at: "desc" };

    if (validSortFields.has(sortBy as any)) {
      orderBy = {
        [sortBy]: (sortOrder === "asc" ? "asc" : "desc"),
      } as Prisma.booksOrderByWithRelationInput;
    }

    const [total, items] = await Promise.all([
      prisma.books.count({ where }),
      prisma.books.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          genre: { select: { id: true, name: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      message: "Daftar buku berhasil diambil.",
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
    });
  }
};


// ====== GET DETAIL ======
export const getBookDetail = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { book_id } = req.params;

    const book = await prisma.books.findFirst({
      where: { id: book_id, deleted_at: null },
      include: {
        genre: { select: { id: true, name: true } },
      },
    });

    if (!book) {
      return res.status(404).json({ success: false, message: "Buku tidak ditemukan." });
    }

    return res.json({ success: true, message: "Detail buku berhasil diambil.", data: book });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
};

// ====== GET BY GENRE (filter + pagination) ======
export const getBooksByGenre = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { genre_id } = req.params;
    const { page = "1", limit = "10", search } = req.query as Record<string, string>;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const genre = await prisma.genres.findUnique({ where: { id: genre_id } });
    if (!genre) {
      return res.status(404).json({ success: false, message: "Genre tidak ditemukan." });
    }

    const where: any = {
      deleted_at: null,
      genre_id,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { writer: { contains: search, mode: "insensitive" } },
          { publisher: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      prisma.books.count({ where }),
      prisma.books.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: "desc" },
        include: { genre: { select: { id: true, name: true } } },
      }),
    ]);

    return res.json({
      success: true,
      message: "Daftar buku per genre berhasil diambil.",
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
};

// ====== UPDATE (PATCH) ======
export const updateBook = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { book_id } = req.params;
    const {
      title,
      writer,
      publisher,
      description,
      publication_year,
      price,
      stock_quantity,
      genre_id,
    } = req.body;

    // Pastikan buku ada & belum dihapus
    const existing = await prisma.books.findFirst({
      where: { id: book_id, deleted_at: null },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Buku tidak ditemukan." });
    }

    // Build data partial
    const data: any = { updated_at: new Date() };
    if (title !== undefined) data.title = title;
    if (writer !== undefined) data.writer = writer;
    if (publisher !== undefined) data.publisher = publisher;
    if (description !== undefined) data.description = description;

    if (publication_year !== undefined) {
      const pubYear = Number(publication_year);
      if (Number.isNaN(pubYear)) {
        return res.status(400).json({ success: false, message: "publication_year harus number." });
      }
      data.publication_year = pubYear;
    }

    if (price !== undefined) {
  const bookPrice = Number(price);
  if (Number.isNaN(bookPrice)) {
    return res.status(400).json({ success: false, message: "price harus number." });
  }
  if (bookPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "price tidak boleh negatif.",
    });
  }
  data.price = bookPrice;
}

    if (stock_quantity !== undefined) {
  const stockQty = Number(stock_quantity);
  if (Number.isNaN(stockQty)) {
    return res.status(400).json({ success: false, message: "stock_quantity harus number." });
  }
  if (stockQty < 0 || !Number.isInteger(stockQty)) {
    return res.status(400).json({
      success: false,
      message: "stock_quantity harus bilangan bulat dan tidak boleh negatif.",
    });
  }
  data.stock_quantity = stockQty;
}

    if (genre_id !== undefined) {
      const g = await prisma.genres.findUnique({ where: { id: genre_id } });
      if (!g) {
        return res.status(400).json({ success: false, message: "genre_id tidak valid." });
      }
      data.genre_id = genre_id;
    }

    const updated = await prisma.books.update({
      where: { id: book_id },
      data,
    });

    return res.json({ success: true, message: "Buku berhasil diperbarui.", data: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Data melanggar unique constraint (mungkin title sudah digunakan).",
      });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
};

// ====== DELETE (soft delete + blokir jika sudah ada transaksi) ======
export const deleteBook = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }
    
    const { book_id } = req.params;

    const book = await prisma.books.findFirst({
      where: { id: book_id, deleted_at: null },
      include: { order_items: { select: { id: true }, take: 1 } },
    });

    if (!book) {
      return res.status(404).json({ success: false, message: "Buku tidak ditemukan." });
    }

    if (book.order_items.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Buku tidak bisa dihapus karena sudah memiliki transaksi pembelian.",
      });
    }

    const deleted = await prisma.books.update({
      where: { id: book_id },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });

    return res.json({ success: true, message: "Buku berhasil dihapus.", data: deleted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
};
