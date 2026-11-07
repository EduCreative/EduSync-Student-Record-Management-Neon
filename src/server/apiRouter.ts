import { Router } from 'express';
import loginHandler from './handlers/auth/login';
import meHandler from './handlers/auth/me';
import logoutHandler from './handlers/auth/logout';
import changePasswordHandler from './handlers/auth/change-password';
import registerHandler from './handlers/auth/register';

import dataIndexHandler from './handlers/data/index';
import studentsHandler from './handlers/data/students';
import feesHandler from './handlers/data/fees';
import usersHandler from './handlers/data/users';
import schoolsHandler from './handlers/data/schools';

import paymentsWriteHandler from './handlers/write/payments';
import challansWriteHandler from './handlers/write/challans';
import academicWriteHandler from './handlers/write/academic';
import studentsWriteHandler from './handlers/write/students';
import classesWriteHandler from './handlers/write/classes';
import usersWriteHandler from './handlers/write/users';
import restoreWriteHandler from './handlers/write/restore';
import notificationsHandler from './handlers/notifications/index';
import photoHandler from './handlers/photo';
import backupHandler from './handlers/data/backup';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
    res.json({ success: true, message: 'EduSync API service operational', timestamp: new Date().toISOString() });
});

apiRouter.all('/auth/login', (req, res) => loginHandler(req, res));

apiRouter.all('/auth/me', (req, res) => meHandler(req, res));
apiRouter.all('/auth/logout', (req, res) => logoutHandler(req, res));
apiRouter.all('/auth/change-password', (req, res) => changePasswordHandler(req, res));
apiRouter.all('/auth/register', (req, res) => registerHandler(req, res));

apiRouter.all('/data', (req, res) => dataIndexHandler(req, res));
apiRouter.all('/data/students', (req, res) => studentsHandler(req, res));
apiRouter.all('/data/fees', (req, res) => feesHandler(req, res));
apiRouter.all('/data/users', (req, res) => usersHandler(req, res));
apiRouter.all('/data/schools', (req, res) => schoolsHandler(req, res));
apiRouter.all('/photo', (req, res) => photoHandler(req, res));
apiRouter.all('/backup', (req, res) => backupHandler(req, res));

apiRouter.all('/write/payments', (req, res) => paymentsWriteHandler(req, res));
apiRouter.all('/write/challans', (req, res) => challansWriteHandler(req, res));
apiRouter.all('/write/academic', (req, res) => academicWriteHandler(req, res));
apiRouter.all('/write/students', (req, res) => studentsWriteHandler(req, res));
apiRouter.all('/write/classes', (req, res) => classesWriteHandler(req, res));
apiRouter.all('/write/users', (req, res) => usersWriteHandler(req, res));
apiRouter.all('/write/restore', (req, res) => restoreWriteHandler(req, res));
apiRouter.all('/notifications', (req, res) => notificationsHandler(req, res));
