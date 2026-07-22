// utils/imageService.js - FIXED PATH HANDLING
const { deleteFile, getFileUrl, getFallbackImageUrl } = require('../middlewares/upload.middleware');
const path = require('path');

/**
 * Enhanced Image Service with fixed path handling
 */
class ImageService {
  constructor() {
    this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.processingOptions = {
      quality: 85,
      format: 'jpeg',
      progressive: true
    };
  }

  /**
   * 🔧 FIX: Enhanced uploadImage with proper path extraction
   */
  async uploadImage(file, folder = 'uploads', _options = {}) {
    try {
      console.log('🔍 ImageService: Processing upload for folder:', folder);
      console.log('🔍 File object received:', {
        fieldname: file?.fieldname,
        originalname: file?.originalname,
        filename: file?.filename,
        path: file?.path,
        destination: file?.destination,
        key: file?.key,
        location: file?.location,
        size: file?.size
      });
      
      if (!file) {
        throw new Error('No file provided to uploadImage');
      }

      // Validate the file before processing
      const validation = this.validateImage(file);
      if (!validation.isValid) {
        throw new Error(`Image validation failed: ${validation.errors.join(', ')}`);
      }

      // 🔧 Extract information properly
      const result = {
        url: this.getImageUrl(file),
        path: this.getImagePath(file),
        originalName: file.originalname,
        size: file.size,
        contentType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        folder: folder
      };

      // Validate that we have required fields
      if (!result.url) {
        console.error('❌ Failed to generate URL from file:', file);
        throw new Error('Failed to generate image URL from uploaded file');
      }
      
      if (!result.path) {
        console.error('❌ Failed to generate path from file:', file);
        throw new Error('Failed to generate image path from uploaded file');
      }

      console.log('✅ ImageService: Upload processed successfully:', {
        folder,
        url: result.url,
        path: result.path,
        size: result.size
      });

      return result;
      
    } catch (error) {
      console.error('❌ ImageService: Upload error:', error);
      
      // Clean up file if it was uploaded but processing failed
      if (file && (file.path || file.key)) {
        await this.deleteImage(file.path || file.key);
      }
      
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  /**
   * 🔧 FIX: Enhanced getImageUrl with proper path extraction
   */
  getImageUrl(file) {
    try {
      if (!file) {
        console.log('⚠️ ImageService: No file provided to getImageUrl');
        return null;
      }

      console.log('🔍 ImageService: Getting URL from file:', {
        location: file.location,
        path: file.path,
        filename: file.filename,
        key: file.key,
        destination: file.destination
      });

      // For S3 uploads, file.location contains the full URL
      if (file.location) {
        console.log('✅ ImageService: Using S3 location URL:', file.location);
        return file.location;
      }

      // 🔧 For local uploads, construct path properly
      if (file.path) {
        const url = getFileUrl(file.path);
        console.log('✅ ImageService: Generated URL from file.path:', { 
          filePath: file.path, 
          url: url 
        });
        return url;
      }

      // 🔧 Fallback: construct path from destination + filename
      if (file.destination && file.filename) {
        // Combine destination and filename
        const fullPath = path.join(file.destination, file.filename);
        const url = getFileUrl(fullPath);
        console.log('✅ ImageService: Generated URL from destination+filename:', { 
          destination: file.destination,
          filename: file.filename,
          fullPath: fullPath,
          url: url 
        });
        return url;
      }

      // Fallback to filename only
      if (file.filename) {
        const url = getFileUrl(file.filename);
        console.log('✅ ImageService: Generated URL from filename only:', { 
          filename: file.filename, 
          url: url 
        });
        return url;
      }

      // Use S3 key if available
      if (file.key) {
        const url = getFileUrl(file.key);
        console.log('✅ ImageService: Generated URL from S3 key:', { 
          key: file.key, 
          url: url 
        });
        return url;
      }

      console.error('❌ ImageService: No valid path found in file object');
      return null;
    } catch (error) {
      console.error('❌ ImageService: Error generating image URL:', error);
      return null;
    }
  }

  /**
   * 🔧 FIX: Enhanced getImagePath with proper path extraction
   */
  getImagePath(file) {
    try {
      if (!file) {
        console.log('⚠️ ImageService: No file provided to getImagePath');
        return null;
      }

      console.log('🔍 ImageService: Getting path from file:', {
        key: file.key,
        path: file.path,
        filename: file.filename,
        destination: file.destination
      });

      // Priority for S3: key
      if (file.key) {
        console.log('✅ ImageService: Using S3 key as path:', file.key);
        return file.key;
      }

      // 🔧 For local files: use relative path if possible
      if (file.path) {
        // If it's an absolute path, try to make it relative to uploads directory
        if (path.isAbsolute(file.path)) {
          const uploadsRoot = path.join(__dirname, '..', 'uploads');
          if (file.path.startsWith(uploadsRoot)) {
            const relativePath = path.relative(uploadsRoot, file.path).replace(/\\/g, '/');
            const finalPath = `uploads/${relativePath}`;
            console.log('✅ ImageService: Converted absolute to relative path:', {
              absolute: file.path,
              relative: finalPath
            });
            return finalPath;
          }
        }
        
        // Use path as is if it's already relative
        console.log('✅ ImageService: Using file.path as is:', file.path);
        return file.path;
      }

      // 🔧 Construct from destination + filename
      if (file.destination && file.filename) {
        const fullPath = path.join(file.destination, file.filename);
        
        // Convert to relative path if it's absolute
        if (path.isAbsolute(fullPath)) {
          const uploadsRoot = path.join(__dirname, '..', 'uploads');
          if (fullPath.startsWith(uploadsRoot)) {
            const relativePath = path.relative(uploadsRoot, fullPath).replace(/\\/g, '/');
            const finalPath = `uploads/${relativePath}`;
            console.log('✅ ImageService: Generated relative path from destination+filename:', {
              destination: file.destination,
              filename: file.filename,
              fullPath: fullPath,
              finalPath: finalPath
            });
            return finalPath;
          }
        }
        
        console.log('✅ ImageService: Using destination+filename path:', fullPath);
        return fullPath;
      }

      // Fallback to filename only
      if (file.filename) {
        console.log('✅ ImageService: Using filename as fallback path:', file.filename);
        return file.filename;
      }

      console.error('❌ ImageService: No valid path found in file object');
      return null;
    } catch (error) {
      console.error('❌ ImageService: Error getting image path:', error);
      return null;
    }
  }

  /**
   * Delete image using the upload middleware's deleteFile function
   */
  async deleteImage(imagePath) {
    try {
      if (!imagePath) {
        console.log('⚠️ ImageService: No image path provided for deletion');
        return true; // Consider it successful if no path provided
      }

      console.log('🔍 ImageService: Attempting to delete image:', imagePath);
      const result = await deleteFile(imagePath);
      
      if (result) {
        console.log('✅ ImageService: Successfully deleted image:', imagePath);
      } else {
        console.log('⚠️ ImageService: Failed to delete image:', imagePath);
      }
      
      return result;
    } catch (error) {
      console.error('❌ ImageService: Delete image error:', error);
      return false;
    }
  }

  /**
   * Validate uploaded image file
   */
  validateImage(file) {
    const errors = [];

    try {
      if (!file) {
        errors.push('No file provided');
        return { isValid: false, errors };
      }

      // Check file type
      if (!this.allowedTypes.includes(file.mimetype)) {
        errors.push(`Invalid file type: ${file.mimetype}. Allowed types: ${this.allowedTypes.join(', ')}`);
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        errors.push(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`);
      }

      // Check filename
      if (!file.originalname || file.originalname.trim() === '') {
        errors.push('Invalid filename');
      }

      // Check for dangerous file extensions
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      if (!allowedExtensions.includes(ext)) {
        errors.push(`Invalid file extension: ${ext}. Allowed extensions: ${allowedExtensions.join(', ')}`);
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
          extension: ext
        }
      };

      if (result.isValid) {
        console.log('✅ ImageService: File validation passed:', result.fileInfo);
      } else {
        console.log('❌ ImageService: File validation failed:', { errors, fileInfo: result.fileInfo });
      }

      return result;
    } catch (error) {
      console.error('❌ ImageService: Validation error:', error);
      return {
        isValid: false,
        errors: ['Validation error occurred'],
        fileInfo: null
      };
    }
  }

  /**
   * Get display URL for an image path from database
   */
  getDisplayUrl(imagePath) {
    try {
      if (!imagePath) {
        console.log('⚠️ ImageService: No image path provided to getDisplayUrl');
        return null;
      }

      // If already a complete URL, return as is
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
      }

      // Use the upload middleware's getFileUrl function
      const url = getFileUrl(imagePath);
      console.log('✅ ImageService: Generated display URL:', { path: imagePath, url });
      return url;
    } catch (error) {
      console.error('❌ ImageService: Error generating display URL:', error);
      return getFallbackImageUrl();
    }
  }

  /**
   * Get fallback image URL when image is not available
   */
  getFallbackUrl() {
    return getFallbackImageUrl();
  }

  /**
   * Process multiple uploaded images
   */
  async uploadMultipleImages(files, folder = 'uploads', options = {}) {
    try {
      if (!files || !Array.isArray(files) || files.length === 0) {
        console.log('⚠️ ImageService: No files provided to uploadMultipleImages');
        return [];
      }

      console.log(`🔍 ImageService: Processing ${files.length} images for folder: ${folder}`);

      const results = [];
      const errors = [];

      for (let i = 0; i < files.length; i++) {
        try {
          const result = await this.uploadImage(files[i], folder, options);
          results.push({
            ...result,
            index: i,
            isDefault: i === 0 // First image is default
          });
        } catch (error) {
          console.error(`❌ ImageService: Failed to process image ${i}:`, error);
          errors.push({
            index: i,
            filename: files[i]?.originalname || 'unknown',
            error: error.message
          });
        }
      }

      if (errors.length > 0) {
        console.log('⚠️ ImageService: Some images failed to process:', errors);
        
        // If all images failed, throw an error
        if (results.length === 0) {
          throw new Error(`All images failed to process: ${errors.map(e => e.error).join(', ')}`);
        }
        
        // If some images failed, log warning but continue
        console.warn(`⚠️ ImageService: ${errors.length} out of ${files.length} images failed to process`);
      }

      console.log(`✅ ImageService: Successfully processed ${results.length} out of ${files.length} images`);
      return results;
    } catch (error) {
      console.error('❌ ImageService: Multiple upload error:', error);
      throw new Error(`Multiple image upload failed: ${error.message}`);
    }
  }

  /**
   * Cleanup multiple images
   */
  async cleanupImages(imagePaths) {
    try {
      if (!imagePaths || !Array.isArray(imagePaths)) {
        return { success: 0, failed: 0, total: 0 };
      }

      console.log(`🔍 ImageService: Cleaning up ${imagePaths.length} images`);

      let success = 0;
      let failed = 0;

      for (const imagePath of imagePaths) {
        try {
          const result = await this.deleteImage(imagePath);
          if (result) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`❌ ImageService: Failed to cleanup image ${imagePath}:`, error);
          failed++;
        }
      }

      const results = { success, failed, total: imagePaths.length };
      console.log('✅ ImageService: Cleanup completed:', results);
      return results;
    } catch (error) {
      console.error('❌ ImageService: Cleanup error:', error);
      return { success: 0, failed: imagePaths?.length || 0, total: imagePaths?.length || 0 };
    }
  }
}

// Create singleton instance
const imageService = new ImageService();

module.exports = imageService;