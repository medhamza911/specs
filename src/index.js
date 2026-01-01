import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { analyzeRouter } from './routes/analyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/public', express.static(join(__dirname, '..', 'public')));
app.use('/js', express.static(join(__dirname, '..', 'public', 'js')));

// Routes
app.get('/', (req, res) => {
  const htmlPath = join(__dirname, '..', 'public', 'compare.html');
  const html = readFileSync(htmlPath, 'utf-8');
  res.send(html);
});

app.get('/favicon.ico', (req, res) => {
  res.redirect('/public/favicon.svg');
});

// API Routes
app.use('/api', analyzeRouter);

// Start server
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

export default app;
