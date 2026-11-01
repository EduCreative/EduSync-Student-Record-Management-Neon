import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Import serverless API handlers
import loginHandler from './api/auth/login';
import meHandler from './api/auth/me';
import logoutHandler from './api/auth/logout';
import changePasswordHandler from './api/auth/change-password';
import registerHandler from './api/auth/register';

// Import serverless Data read handlers
import dataIndexHandler from './api/data/index';
import studentsHandler from './api/data/students';
import feesHandler from './api/data/fees';
import usersHandler from './api/data/users';
import schoolsHandler from './api/data/schools';

// Import serverless Write mutation handlers (Stage 3)
import paymentsWriteHandler from './api/write/payments';
import challansWriteHandler from './api/write/challans';
import academicWriteHandler from './api/write/academic';
import studentsWriteHandler from './api/write/students';
import classesWriteHandler from './api/write/classes';
import usersWriteHandler from './api/write/users';
import restoreWriteHandler from './api/write/restore';
import notificationsHandler from './api/notifications/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    // Port 3000 required by AI Studio runtime environment proxy
    const port = 3000;
    const isProd = process.env.NODE_ENV === 'production';

    // Parse JSON bodies (with adequate limit for bulk backup/import data)
    app.use(express.json({ limit: '50mb' }));

    // Serverless Auth API endpoints
    app.all('/api/auth/login', (req, res) => loginHandler(req, res));
    app.all('/api/auth/me', (req, res) => meHandler(req, res));
    app.all('/api/auth/logout', (req, res) => logoutHandler(req, res));
    app.all('/api/auth/change-password', (req, res) => changePasswordHandler(req, res));
    app.all('/api/auth/register', (req, res) => registerHandler(req, res));

    // Serverless Data Read API endpoints (Stage 2)
    app.all('/api/data', (req, res) => dataIndexHandler(req, res));
    app.all('/api/data/students', (req, res) => studentsHandler(req, res));
    app.all('/api/data/fees', (req, res) => feesHandler(req, res));
    app.all('/api/data/users', (req, res) => usersHandler(req, res));
    app.all('/api/data/schools', (req, res) => schoolsHandler(req, res));

    // Serverless Write Mutation API endpoints (Stage 3)
    app.all('/api/write/payments', (req, res) => paymentsWriteHandler(req, res));
    app.all('/api/write/challans', (req, res) => challansWriteHandler(req, res));
    app.all('/api/write/academic', (req, res) => academicWriteHandler(req, res));
    app.all('/api/write/students', (req, res) => studentsWriteHandler(req, res));
    app.all('/api/write/classes', (req, res) => classesWriteHandler(req, res));
    app.all('/api/write/users', (req, res) => usersWriteHandler(req, res));
    app.all('/api/write/restore', (req, res) => restoreWriteHandler(req, res));
    app.all('/api/notifications', (req, res) => notificationsHandler(req, res));

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
