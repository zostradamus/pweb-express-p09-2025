import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { user_id, items } = req.body;

    // Validasi dasar
    if (!user_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body: user_id dan items wajib diisi",
      });
    }

    for (const item of items) {
      if (!item.book_id || typeof item.quantity !== "number") {
        return res.status(400).json({
          success: false,
          message: "Setiap item harus memiliki book_id dan quantity (number)",
        });
      }
    }

    // ✅ Pastikan user valid
    const userExists = await prisma.users.findUnique({
      where: { id: user_id },
    });

    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan. Pastikan user_id valid.",
      });
    }

    // ✅ (Opsional tapi disarankan) Pastikan semua book_id valid
    for (const item of items) {
      const bookExists = await prisma.books.findUnique({
        where: { id: item.book_id },
      });
      if (!bookExists) {
        return res.status(404).json({
          success: false,
          message: `Buku dengan id ${item.book_id} tidak ditemukan.`,
        });
      }
    }

    // ✅ Buat id order dengan UUID (aman & sesuai schema)
    const orderId = uuidv4();

    // Simpan ke tabel orders
    const order = await prisma.orders.create({
      data: {
        id: orderId,
        user_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Simpan item-itemnya ke tabel order_items
    const orderItems = await Promise.all(
      items.map((item: any) =>
        prisma.order_items.create({
          data: {
            order_id: order.id,
            book_id: item.book_id,
            quantity: item.quantity,
            created_at: new Date(),
            updated_at: new Date(),
          },
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: "Transaction (order) created successfully",
      data: {
        order,
        items: orderItems,
      },
    });
  } catch (error: any) {
    console.error("ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Akses ditolak. Token tidak ditemukan.",
      });
    }

    // Ambil token
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    const userId = decoded.id;

    // Ambil query param
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = (req.query.search as string) || "";
    const orderById = (req.query.orderById as "asc" | "desc") || "asc";
    const orderByAmount = (req.query.orderByAmount as "asc" | "desc") || "";
    const orderByPrice = (req.query.orderByPrice as "asc" | "desc") || "";

    const skip = (page - 1) * limit;

    // Ambil data dari database HANYA untuk user yang login
    const transactions = await prisma.orders.findMany({
      skip,
      take: limit,
      where: {
        user_id: userId, // filter transaksi milik user login
        OR: [
          {
            id: { contains: search, mode: "insensitive" },
          },
          {
            user: {
              username: { contains: search, mode: "insensitive" },
            },
          },
        ],
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
        order_items: {
          include: {
            book: { select: { id: true, title: true, price: true } },
          },
        },
      },
      orderBy: [{ id: orderById }],
    });

    // Hitung total dan rata-rata
    const transactionsWithTotals = transactions.map((t) => {
      const totalAmount = t.order_items.reduce(
        (sum, item) => sum + item.quantity * item.book.price,
        0
      );
      const avgPrice =
        t.order_items.length > 0
          ? t.order_items.reduce((sum, item) => sum + item.book.price, 0) /
            t.order_items.length
          : 0;

      return { ...t, totalAmount, avgPrice };
    });

    // Sorting manual
    if (orderByAmount) {
      transactionsWithTotals.sort((a, b) =>
        orderByAmount === "asc"
          ? a.totalAmount - b.totalAmount
          : b.totalAmount - a.totalAmount
      );
    } else if (orderByPrice) {
      transactionsWithTotals.sort((a, b) =>
        orderByPrice === "asc" ? a.avgPrice - b.avgPrice : b.avgPrice - a.avgPrice
      );
    }

    return res.status(200).json({
      success: true,
      message: "Transaksi user berhasil diambil",
      data: transactionsWithTotals,
    });
  } catch (error: any) {
    console.error("ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const { id } = req.params;

    // Validasi input
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Parameter id wajib diisi",
      });
    }

    // Cari transaksi berdasarkan ID
    const transaction = await prisma.orders.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, email: true },
        },
        order_items: {
          include: {
            book: {
              select: { id: true, title: true, price: true },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction tidak ditemukan",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction retrieved successfully",
      data: transaction,
    });
  } catch (error: any) {
    console.error("ERROR DETAIL:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// // GET statistik transaksi
export const getTransactionStats = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }
    
    // Ambil semua transaksi lengkap dengan item dan buku + genre
    const transactions = await prisma.orders.findMany({
      include: {
        order_items: {
          include: {
            book: {
              include: {
                genre: true,
              },
            },
          },
        },
      },
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No transactions found",
        data: {
          totalTransactions: 0,
          avgTransactionValue: 0,
          topGenre: null,
          leastGenre: null,
        },
      });
    }

    // Hitung total transaksi
    const totalTransactions = transactions.length;

    // Hitung nominal tiap transaksi
    const transactionTotals = transactions.map((t) =>
      t.order_items.reduce(
        (sum, item) => sum + item.quantity * item.book.price,
        0
      )
    );

    // Rata-rata nominal tiap transaksi
    const avgTransactionValue =
      transactionTotals.reduce((a, b) => a + b, 0) / totalTransactions;

    // Hitung jumlah transaksi per genre
    const genreStats: Record<string, number> = {};
    transactions.forEach((t) => {
      const uniqueGenres = new Set(
        t.order_items.map((item) => item.book.genre?.name)
      );
      uniqueGenres.forEach((genre) => {
        if (!genre) return;
        genreStats[genre] = (genreStats[genre] || 0) + 1;
      });
    });

    // Cari genre terbanyak dan tersedikit
    let topGenre = null;
    let leastGenre = null;
    if (Object.keys(genreStats).length > 0) {
      const sortedGenres = Object.entries(genreStats).sort(
        (a, b) => b[1] - a[1]
      );
      topGenre = { genre: sortedGenres[0][0], count: sortedGenres[0][1] };
      leastGenre = {
        genre: sortedGenres[sortedGenres.length - 1][0],
        count: sortedGenres[sortedGenres.length - 1][1],
      };
    }

    return res.status(200).json({
      success: true,
      message: "Transaction statistics retrieved successfully",
      data: {
        totalTransactions,
        avgTransactionValue,
        topGenre,
        leastGenre,
      },
    });
  } catch (error: any) {
    console.error("ERROR DETAIL:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


