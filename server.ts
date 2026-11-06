import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/apiRouter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    // Port 3000 required by AI Studio runtime environment proxy
    const port = Number(process.env.PORT) || 3000;
    const isProd = process.env.NODE_ENV === 'production';

    // Parse JSON bodies (with adequate limit for bulk backup/import data)
    app.use(express.json({ limit: '50mb' }));

    // Mount consolidated API router
    app.use('/api', apiRouter);

    if (!isProd) {
        // Dev mode: Mount Vite middleware
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        // Production mode: Serve built static files
        const distPath = path.resolve(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
            res.sendFile(path.resolve(distPath, 'index.html'));
        });
    }

    app.listen(port, '0.0.0.0', () => {
        console.log(`EduSync server running on http://0.0.0.0:${port}`);
    });
}

startServer().catch((err) => {
    console.error("Failed to start EduSync server:", err);
    process.exit(1);
});
