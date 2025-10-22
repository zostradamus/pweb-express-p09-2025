import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import prisma from './config/prisma';

import authRoutes from './routes/authRoutes';
import genreRoutes from './routes/genreRoutes';
import libraryRoutes from './routes/libraryRoutes';
import transactionRoutes from './routes/transactionRoutes';

import { authenticateUser } from "./middleware/authMiddleware";


dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authenticateUser);

// Test route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Express + Prisma + PostgreSQL' });
});

app.use('/auth', authRoutes);
app.use('/genre', genreRoutes);
app.use('/books', libraryRoutes);
app.use('/transactions', transactionRoutes);


app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Database disconnected');
  process.exit(0);
});