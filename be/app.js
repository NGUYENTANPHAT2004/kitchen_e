// app.js - Updated với enhanced file upload support
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const passport = require('./config/passport');
const errorHandler = require('./middlewares/error.middleware');
const { requestLogger, errorLogger } = require('./middlewares/logger.middleware');
const { defaultLimiter, authLimiter } = require('./middlewares/limiter.middleware');
const path = require('path');

const { initializeStaticFiles } = require('./middlewares/static.middleware');
const { getFileUrl, getFallbackImageUrl } = require('./middlewares/upload.middleware');


const app = express();


app.use(requestLogger);


app.use(compression());


app.use(helmet({
  crossOriginResourcePolicy: { 
    policy: "cross-origin" 
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));


app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      const error = new Error('Invalid JSON format');
      error.status = 400;
      throw error;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb' 
}));


app.use(cookieParser());


app.use(
  session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);


app.use(passport.initialize());


app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
      
      
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Length']
  })
);


app.use(mongoSanitize());


app.use(xss());


app.use(hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'category', 'tags', 'featured']
}));


try {
  initializeStaticFiles(app);
  console.log(' Static file serving initialized successfully');
} catch (error) {
  console.error(' Failed to initialize static file serving:', error);
}


// Uploaded files are mounted once by initializeStaticFiles above.


app.use('/api/', defaultLimiter);


app.use('/api/auth/', authLimiter);


app.get('/api/utils/file-url/:path(*)', (req, res) => {
  try {
    const filePath = req.params.path;
    const fullUrl = getFileUrl(filePath);
    
    if (fullUrl) {
      res.json({
        success: true,
        url: fullUrl,
        path: filePath
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'File path invalid'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate file URL'
    });
  }
});

app.get('/api/utils/fallback-image', (req, res) => {
  try {
    const fallbackUrl = getFallbackImageUrl();
    res.json({
      success: true,
      url: fallbackUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get fallback image URL'
    });
  }
});


app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    storage: {
      type: process.env.STORAGE_TYPE || 'local',
      maxFileSize: process.env.MAX_FILE_SIZE || '10MB'
    },
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Routes
app.use('/api/auth', require('./routes/api/auth.routes'));
app.use('/api/products', require('./routes/api/products.routes'));
app.use('/api/bundles', require('./routes/api/bundles.routes'));
app.use('/api/categories', require('./routes/api/categories.routes'));
app.use('/api/recipes', require('./routes/api/recipes.routes'));
app.use('/api/cart', require('./routes/api/carts.routes'));
app.use('/api/orders', require('./routes/api/orders.routes'));
app.use('/api/payments', require('./routes/api/payments.routes'));
app.use('/api/wishlist', require('./routes/api/wishlist.routes'));
app.use('/api/users', require('./routes/api/users.routes'));
app.use('/api/flash-sales', require('./routes/api/flash-sales.routes'));
app.use('/api/reviews', require('./routes/api/reviews.routes'));
app.use('/api/vouchers', require('./routes/api/vouchers.routes'));
app.use('/api/notifications', require('./routes/api/notifications.routes'));
app.use('/api/socket', require('./routes/api/socket.routes'));
app.use('/api/ai', require('./routes/api/ai.routes'));


app.get('/api', (req, res) => {
  res.json({
    message: 'API Server is running',
    version: '1.0.0',
    storage: process.env.STORAGE_TYPE || 'local',
    endpoints: {
      auth: '/api/auth',
      categories: '/api/categories',
      products: '/api/products',
      users: '/api/users',
      ai: '/api/ai',
      health: '/api/health',
      utils: {
        fileUrl: '/api/utils/file-url/:path',
        fallbackImage: '/api/utils/fallback-image'
      }
    }
  });
});


if (process.env.NODE_ENV === 'production') {

  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}


app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      '/api/auth',
      '/api/categories',
      '/api/products',
      '/api/users',
      '/api/health'
    ]
  });
});


app.use(errorLogger);


app.use((error, req, res, next) => {

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: `File size exceeds the maximum limit of ${process.env.MAX_FILE_SIZE || '10MB'}`
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files',
      message: 'Maximum number of files exceeded'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      message: 'File field name is not allowed'
    });
  }
  

  if (error.message && error.message.includes('Image')) {
    return res.status(400).json({
      error: 'Image processing failed',
      message: error.message
    });
  }
  errorHandler(error, req, res, next);
});

module.exports = app;