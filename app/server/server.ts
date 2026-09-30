import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { api } from './api.js';
import { ApiError, errorHandler } from './http.js';
import { testRoutes } from './test-routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const enableTestRoutes = process.env.ENABLE_TEST_ROUTES === 'true';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

app.use('/api', api);
if (enableTestRoutes) app.use('/api/test', testRoutes);
app.use('/api', () => {
  throw new ApiError(404, 'NOT_FOUND', 'Route not found');
});
app.use(errorHandler);

app.use(express.static(path.join(here, '..', 'public'), { extensions: ['html'] }));

app.listen(port, () => {
  console.log(`Gigbox running on http://localhost:${port}${enableTestRoutes ? ' (test routes enabled)' : ''}`);
});
