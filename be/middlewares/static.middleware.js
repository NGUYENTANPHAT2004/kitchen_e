// middlewares/static.middleware.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { getFileUrl } = require('./upload.middleware');

const uploadsPath = path.join(__dirname, '..', 'uploads');
const imageRequestPattern = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

const ensureUploadDirectories = () => {
  fs.mkdirSync(uploadsPath, { recursive: true });
  for (const directory of [
    'products',
    'categories',
    'variants',
    'reviews',
    'avatars',
    'banners',
    'customizations',
    'fallback'
  ]) {
    fs.mkdirSync(path.join(uploadsPath, directory), { recursive: true });
  }
  createFallbackImage(path.join(uploadsPath, 'fallback'));
};

/**
 * Serve the contents of uploadsPath at the mount point supplied by app.use.
 * The previous implementation mounted a router containing /uploads below
 * /uploads, which produced /uploads/uploads/... and also shadowed download
 * routes with an eager 404 handler.
 */
const createStaticMiddleware = () => {
  ensureUploadDirectories();
  const router = express.Router();

  router.use((req, res, next) => {
    const requestedPath = decodeURIComponent(req.path);
    if (
      requestedPath.includes('..') ||
      requestedPath.includes('~') ||
      requestedPath.startsWith('/etc/')
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  });

  router.use(
    express.static(uploadsPath, {
      dotfiles: 'deny',
      fallthrough: true,
      index: false,
      redirect: false,
      setHeaders: (res, filePath) => {
        if (imageRequestPattern.test(filePath)) {
          res.set('Cache-Control', 'public, max-age=86400');
          res.set('X-Content-Type-Options', 'nosniff');
        }
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
      }
    })
  );

  router.use((req, res) => {
    if (imageRequestPattern.test(req.path)) {
      const pngFallback = path.join(uploadsPath, 'fallback', 'no-image.png');
      const svgFallback = path.join(uploadsPath, 'fallback', 'no-image.svg');
      const fallbackPath = fs.existsSync(pngFallback) ? pngFallback : svgFallback;

      if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
      }
    }

    return res.status(404).json({
      error: 'File not found',
      path: req.path,
      message: 'The requested file could not be found'
    });
  });

  return router;
};

const createFallbackImage = (fallbackDir) => {
  fs.mkdirSync(fallbackDir, { recursive: true });
  const fallbackImagePath = path.join(fallbackDir, 'no-image.png');
  const fallbackSvgPath = path.join(fallbackDir, 'no-image.svg');

  if (fs.existsSync(fallbackImagePath) || fs.existsSync(fallbackSvgPath)) {
    return;
  }

  const assetsPath = path.join(__dirname, '..', 'assets', 'no-image.png');
  if (fs.existsSync(assetsPath)) {
    fs.copyFileSync(assetsPath, fallbackImagePath);
    return;
  }

  const svgContent = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="14" fill="#999">
        No Image
      </text>
    </svg>
  `;
  fs.writeFileSync(fallbackSvgPath, svgContent, 'utf8');
};

const createDownloadMiddleware = () => {
  return (req, res) => {
    const { filename } = req.params;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(uploadsPath, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    return fs.createReadStream(filePath).pipe(res);
  };
};

const createFileInfoMiddleware = () => {
  return (req, res) => {
    const { filename } = req.params;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(uploadsPath, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    const extension = path.extname(filename).toLowerCase();
    const type = imageRequestPattern.test(filename)
      ? 'image'
      : extension === '.pdf'
        ? 'document'
        : 'unknown';

    return res.json({
      success: true,
      data: {
        filename,
        size: stats.size,
        type,
        extension,
        created: stats.birthtime,
        modified: stats.mtime,
        url: getFileUrl(filename),
        downloadUrl: `/api/files/download/${filename}`
      }
    });
  };
};

const initializeStaticFiles = (app) => {
  ensureUploadDirectories();

  // Register exact routes before the catch-all static middleware.
  app.get('/api/files/download/:filename', createDownloadMiddleware());
  app.get('/api/files/info/:filename', createFileInfoMiddleware());
  app.use('/api/files', createStaticMiddleware());
  app.use('/uploads', createStaticMiddleware());
};

module.exports = {
  createStaticMiddleware,
  createDownloadMiddleware,
  createFileInfoMiddleware,
  initializeStaticFiles,
  createFallbackImage
};
