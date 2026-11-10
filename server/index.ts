import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServerApp } from './app';

const PORT = Number(process.env.PORT || 3001);
const app = createServerApp();

const distPath = path.resolve(process.cwd(), 'dist');
const indexHtmlPath = path.join(distPath, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(indexHtmlPath);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[KhaoThi Authoritative API & App Server] Listening on http://localhost:${PORT}`);
});

