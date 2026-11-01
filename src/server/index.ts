import express from 'express';
import { apiRouter } from './apiRouter';

const app = express();

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Restore original URL if rewritten by Vercel edge proxy
app.use((req, _res, next) => {
    if (req.originalUrl && req.url !== req.originalUrl) {
        req.url = req.originalUrl;
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

export default function handler(req: any, res: any) {
    return app(req, res);
}
