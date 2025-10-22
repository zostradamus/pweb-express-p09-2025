import express from "express";
import {
  createGenre,
  getAllGenres,
  getGenreById,
  updateGenre,
  deleteGenre,
} from "../controllers/genreController";

const router = express.Router();

// Create Genre
router.post("/", createGenre);

// Get All Genre
router.get("/", getAllGenres);

// Get Genre Detail
router.get("/:genre_id", getGenreById);

// Update Genre
router.patch("/:genre_id", updateGenre);

// Delete Genre
router.delete("/:genre_id", deleteGenre);

export default router;

