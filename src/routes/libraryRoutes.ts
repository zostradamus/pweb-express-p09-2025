// src/routes/libraryroutes.ts
import express from "express";
import {
  createBook,
  getAllBooks,
  getBookDetail,
  getBooksByGenre,
  updateBook,
  deleteBook,
} from "../controllers/libraryController";

const router = express.Router();

// Health check kecil untuk memastikan router aktif
router.get("/ping", (_req, res) => {
  res.json({ success: true, message: "Library route aktif" });
});

// 📚 Create Book
// POST /library/books
router.post("/", createBook);

// 📖 Get All Books (dengan filter, pagination, dan sorting)
// GET /library/books
router.get("/", getAllBooks);

// 📘 Get Book Detail
// GET /library/books/:book_id
router.get("/:book_id", getBookDetail);

// 🎭 Get Book By Genre
// GET /library/books/genre/:genre_id
router.get("/genre/:genre_id", getBooksByGenre);

// ✏️ Update Book
// PATCH /library/:book_id
router.patch("/:book_id", updateBook);

// ❌ Delete Book (soft delete)
// DELETE /library/:book_id
router.delete("/:book_id", deleteBook);

export default router;
