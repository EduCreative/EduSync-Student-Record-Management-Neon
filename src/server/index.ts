import express from 'express';
import { apiRouter } from './apiRouter';

const app = express();

// Parse JSON bodies (with adequate limit for bulk backup/import data)
app.use(express.json({ limit: '50mb' }));

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
    // When Vercel executes rewrites (e.g. /api/(.*) -> /api),
    // req.url may be rewritten to destination ('/api' or '/api/' or '/').
    // Restore the true client requested URL from Vercel headers if modified.
    const matched = (req.headers && (
        (req.headers['x-matched-path'] as string) ||
        (req.headers['x-forwarded-uri'] as string) ||
        (req.headers['x-original-url'] as string) ||
        (req.headers['x-real-url'] as string)
    )) || (req.originalUrl && req.originalUrl !== req.url ? req.originalUrl : null);

    if (matched && (req.url === '/api' || req.url === '/api/' || req.url === '/' || req.url.startsWith('/api?'))) {
        if (matched !== '/api' && matched !== '/api/' && matched !== '/') {
            req.url = matched;
        }
    }

    return app(req, res);
}

