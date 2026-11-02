import express from 'express';
import { apiRouter } from '../src/server/apiRouter';

const app = express();

app.use(express.json({ limit: '50mb' }));

app.use((req, _res, next) => {
    const rawMatched = (req.headers['x-matched-path'] as string) || (req.headers['x-forwarded-uri'] as string) || req.originalUrl;
    if (rawMatched && typeof rawMatched === 'string') {
        req.url = rawMatched;
    }
    next();
});

app.use('/api', apiRouter);
app.use('/', apiRouter);

app.use((req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Server API error:", err);
    res.status(500).json({ error: err?.message || 'Internal server error.' });
});

export default function handler(req: any, res: any) {
    const rawMatched = (req.headers?.['x-matched-path'] as string) || (req.headers?.['x-forwarded-uri'] as string) || req.originalUrl;
    if (rawMatched && typeof rawMatched === 'string' && rawMatched.startsWith('/api')) {
        req.url = rawMatched;
    }
    return app(req, res);
}
