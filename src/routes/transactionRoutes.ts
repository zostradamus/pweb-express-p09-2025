import express from 'express';
import {createTransaction, getAllTransactions, getTransactionById, getTransactionStats} from '../controllers/transactionController';

const router = express.Router();
router.post("/", createTransaction);
router.get("/statistics", getTransactionStats);  // 🔹 harus sebelum /:id
router.get("/:id", getTransactionById);     // 🔹 route dinamis di bawah
router.get("/", getAllTransactions);        // 🔹 route default di paling bawah
export default router;