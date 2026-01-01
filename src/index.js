import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { analyzeRoute } from './routes/analyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = new Hono();

// Middleware
app.use('/*', cors());
app.use('/public/*', serveStatic({ root: './' }));
app.use('/js/*', serveStatic({ root: './public' }));

// Routes
app.get('/', (c) => {
  const htmlPath = join(__dirname, '..', 'public', 'compare.html');
  const html = readFileSync(htmlPath, 'utf-8');
  return c.html(html);
});

// API Routes
app.route('/api', analyzeRoute);

// Start server
const port = process.env.PORT || 3000;

console.log(`🚀 Server running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port: port
});

export default app;
