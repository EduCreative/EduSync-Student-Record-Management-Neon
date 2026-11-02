import express from 'express';
import { apiRouter } from './apiRouter';

const app = express();

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Restore original URL if rewritten by Vercel edge proxy
app.use((req, _res, next) => {
    const rawMatched = (req.headers['x-matched-path'] as string) || (req.headers['x-forwarded-uri'] as string) || req.originalUrl;
    if (rawMatched && typeof rawMatched === 'string') {
        req.url = rawMatched;
    }
    next();
});

// Mount router on both /api and root to handle any routing style
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Fallback 404 for unhandled API routes
app.use((req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// Central error handler
app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Server API error:", err);
    res.status(500).json({ error: err?.message || 'Internal server error.' });
});

export default function handler(req: any, res: any) {
    return app(req, res);
}
