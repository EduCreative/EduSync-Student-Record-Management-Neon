import express from 'express';
import { apiRouter } from '../src/server/apiRouter';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/', apiRouter);

export default app;
