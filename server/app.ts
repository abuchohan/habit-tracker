import 'dotenv/config';
import express from "express";
import router from "./routes/index";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { syncRouter } from './routes/sync.router';
import path from 'node:path';
import fs from 'node:fs';

export const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: { directives: {
  // Safari upgrades localhost asset requests to HTTPS unless this is disabled in development.
  'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
} } }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }
  next();
});
app.use("/api/auth", authLimiter);
app.use("/api", router);
app.use('/api/sync', syncRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
const webDirectory = path.resolve(process.env.WEB_DIR || '../expo-app/dist');
if (fs.existsSync(webDirectory)) {
  app.use(express.static(webDirectory, { setHeaders: (res, file) => {
    if (file.endsWith('sw.js') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  } }));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(webDirectory, 'index.html')));
}
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err instanceof Error ? err.message : 'Request failed');
  res.status(400).json({ error: 'The request could not be processed' });
});

export default app;
