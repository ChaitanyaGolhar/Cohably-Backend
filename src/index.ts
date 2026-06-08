import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';

import authRoutes from './routes/auth.routes.js';
import flatRoutes from './routes/flat.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import balanceRoutes from './routes/balance.routes.js';
import settlementRoutes from './routes/settlement.routes.js';
import rentCycleRoutes from './routes/rentCycle.routes.js';
import commentRoutes from './routes/comment.routes.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

const app = express();
const logger = pinoHttp({ transport: { target: 'pino-pretty' } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/flats', flatRoutes);
app.use('/api/flats/:id/expenses', expenseRoutes);
app.use('/api/flats/:id/balances', balanceRoutes);
app.use('/api/flats/:id/settlements', settlementRoutes);
app.use('/api/flats/:id/rent-cycles', rentCycleRoutes);
app.use('/api/flats/:id/expenses/:expId/comments', commentRoutes);

// Error handler (must be last)
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Cohably server running on http://localhost:${PORT}`);
});

export default app;
