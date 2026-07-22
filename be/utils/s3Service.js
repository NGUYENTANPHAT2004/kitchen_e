// utils/imageService.js
const { deleteFile, getFileUrl } = require('../middlewares/upload.middleware');
const sharp = require('sharp'); // Optional: npm install sharp for image processing

/**
 * Image service that works with existing upload middleware
 */
const imageService = {
  /**
   * Process uploaded image from multer
   * @param {Object} file - Multer file object (from req.file)
   * @param {String} folder - Folder name (already handled by upload middleware)
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processed image info
   */
  async uploadImage(file, _folder = 'categories', _options = {}) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      // File đã được upload bởi multer middleware
      // Chỉ cần xử lý thông tin file và trả về kết quả
      
      const result = {
        url: this.getImageUrl(file),
        path: this.getImagePath(file),
        originalName: file.originalname,
        size: file.size,
        contentType: file.mimetype
      };

      console.log('Image upload result:', result);
      return result;
      
    } catch (error) {
      console.error('Image service error:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  },

  /**
   * Get image URL from uploaded file
   * @param {Object} file - Multer file object
   * @returns {String} - Image URL
   */
  getImageUrl(file) {
    if (!file) return null;

    // Nếu dùng S3, file.location sẽ có URL đầy đủ
    if (file.location) {
      return file.location;
    }

    // Nếu dùng local storage, sử dụng getFileUrl từ upload middleware
    if (file.path) {
      return getFileUrl(file.path);
    }

    // Fallback: tạo URL từ filename
    if (file.filename) {
      return getFileUrl(file.filename);
    }

    return null;
  },

  /**
   * Get image storage path from uploaded file
   * @param {Object} file - Multer file object  
   * @returns {String} - Storage path/key
   */
  getImagePath(file) {
    if (!file) return null;

    // Cho S3: sử dụng key
    if (file.key) {
      return file.key;
    }

    // Cho local storage: sử dụng path hoặc filename
    if (file.path) {
      return file.path;
    }

    if (file.filename) {
      return file.filename;
    }

    return null;
  },

  /**
   * Delete image using existing deleteFile function
   * @param {String} imagePath - Image path/URL to delete
   * @returns {Promise<Boolean>} - Success status
   */
  async deleteImage(imagePath) {
    try {
      if (!imagePath) return true;

      await deleteFile(imagePath);
      return true;
    } catch (error) {
      console.error('Delete image error:', error);
      return false;
    }
  },

  /**
   * Validate uploaded image file
   * @param {Object} file - Multer file object
   * @returns {Object} - Validation result
   */
  validateImage(file) {
    const errors = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push('Invalid file type. Only JPEG, PNG, WebP and GIF are allowed');
    }

    if (file.size > maxSize) {
      errors.push('File size too large. Maximum size is 10MB');
    }

    return {
      isValid: errors.length === 0,
      errors,
      fileInfo: {
        originalName: file.originalname,
        size: file.size,
        type: file.mimetype
      }
    };
  },

  /**
   * Process image with Sharp (optional enhancement)
   * @param {Buffer} buffer - Image buffer
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} - Processed image buffer
   */
  async processImage(buffer, options = {}) {
    try {
      // Chỉ xử lý nếu Sharp có sẵn
      if (!sharp) {
        console.log('Sharp not available, returning original buffer');
        return buffer;
      }

      const {
        width = 800,
        height = 600,
        quality = 85
      } = options;

      const processedBuffer = await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      console.error('Image processing error:', error);
      return buffer; // Return original if processing fails
    }
  },

  /**
   * Get full image URL for display
   * @param {String} imagePath - Image path from database
   * @returns {String} - Full image URL
   */
  getDisplayUrl(imagePath) {
    if (!imagePath) return null;

    // Nếu đã là URL đầy đủ, return luôn
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // Sử dụng getFileUrl từ upload middleware
    return getFileUrl(imagePath);
  },

  /**
   * Create thumbnail from uploaded image (optional)
   * @param {Object} file - Original uploaded file
   * @param {Number} size - Thumbnail size
   * @returns {Promise<String>} - Thumbnail URL
   */
  async createThumbnail(file, size = 150) {
    try {
      if (!sharp || !file.buffer) {
        return this.getImageUrl(file); // Return original if can't process
      }

      // Create thumbnail buffer
      await sharp(file.buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Here you could save the thumbnail separately if needed
      // For now, just return the original URL
      return this.getImageUrl(file);
      
    } catch (error) {
      console.error('Thumbnail creation error:', error);
      return this.getImageUrl(file);
    }
  }
};

module.exports = imageService;