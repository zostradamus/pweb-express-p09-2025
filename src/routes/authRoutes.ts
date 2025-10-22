import express from "express";
import { register, login, getCurrentUser } from '../controllers/authController';

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", getCurrentUser);
export default router;

