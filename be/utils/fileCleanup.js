// utils/fileCleanup.js
const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Category = require('../models/Category');
const Review = require('../models/Review');
const User = require('../models/User');

// Initialize S3 client if using S3 storage
let s3;
const storageType = process.env.STORAGE_TYPE || 'local';

if (storageType === 's3') {
  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
}

/**
 * File Cleanup Service
 */
class FileCleanupService {
  constructor() {
    this.storageType = storageType;
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    this.logFile = path.join(__dirname, '..', 'logs', 'cleanup.log');
    this.dryRun = false; // Set to true to simulate without actually deleting
  }

  /**
   * Log cleanup activities
   * @param {string} message - Log message
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(message);
    
    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(this.logFile);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      fs.appendFileSync(this.logFile, logMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Get all image paths from database models
   * @returns {Promise<Set<string>>} Set of image paths in use
   */
  async getImagePathsInUse() {
    try {
      this.log('Collecting image paths from database...');
      const imagePaths = new Set();

      // Get images from Products
      const products = await Product.find({ isDeleted: false }).select('images');
      products.forEach(product => {
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach(image => {
            if (image.path) imagePaths.add(image.path);
            if (image.url) imagePaths.add(this.extractPathFromUrl(image.url));
          });
        }
      });

      // Get images from Product Variants
      const variants = await ProductVariant.find({ isDeleted: false }).select('images');
      variants.forEach(variant => {
        if (variant.images && Array.isArray(variant.images)) {
          variant.images.forEach(image => {
            if (image.path) imagePaths.add(image.path);
            if (image.url) imagePaths.add(this.extractPathFromUrl(image.url));
          });
        }
      });

      // Get images from Categories
      const categories = await Category.find({ isDeleted: false }).select('image imagePath');
      categories.forEach(category => {
        if (category.imagePath) imagePaths.add(category.imagePath);
        if (category.image) imagePaths.add(this.extractPathFromUrl(category.image));
      });

      // Get images from Reviews
      const reviews = await Review.find({ isDeleted: false }).select('images');
      reviews.forEach(review => {
        if (review.images && Array.isArray(review.images)) {
          review.images.forEach(image => {
            if (image.path) imagePaths.add(image.path);
            if (image.url) imagePaths.add(this.extractPathFromUrl(image.url));
          });
        }
      });

      // Get avatar images from Users
      const users = await User.find({ isDeleted: false }).select('avatar avatarPath');
      users.forEach(user => {
        if (user.avatarPath) imagePaths.add(user.avatarPath);
        if (user.avatar) imagePaths.add(this.extractPathFromUrl(user.avatar));
      });

      // Clean up the paths (remove null/undefined/empty)
      const cleanPaths = new Set();
      imagePaths.forEach(path => {
        if (path && typeof path === 'string' && path.trim() !== '') {
          cleanPaths.add(path.trim());
        }
      });

      this.log(`Found ${cleanPaths.size} image paths in use`);
      return cleanPaths;
    } catch (error) {
      this.log(`Error collecting image paths: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract file path from full URL
   * @param {string} url - Full image URL
   * @returns {string} Extracted path
   */
  extractPathFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
      if (url.startsWith('http')) {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading slash
      }
      return url;
    } catch (error) {
      this.log(`Error extracting path from URL ${url}: ${error.message}`);
      return url;
    }
  }

  /**
   * Get all files from local storage
   * @returns {Promise<string[]>} Array of file paths
   */
  async getLocalFiles() {
    try {
      const files = [];
      
      const walkDir = (dir, baseDir = '') => {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const relativePath = path.join(baseDir, item);
          
          if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath, relativePath);
          } else {
            // Only include image files
            if (this.isImageFile(item)) {
              files.push(relativePath.replace(/\\/g, '/')); // Normalize path separators
            }
          }
        });
      };
      
      walkDir(this.uploadsDir, 'uploads');
      return files;
    } catch (error) {
      this.log(`Error reading local files: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all files from S3 storage
   * @returns {Promise<string[]>} Array of S3 keys
   */
  async getS3Files() {
    try {
      if (!s3) {
        throw new Error('S3 client not initialized');
      }

      const files = [];
      let continuationToken;

      do {
        const command = new ListObjectsV2Command({
          Bucket: process.env.AWS_BUCKET,
          ContinuationToken: continuationToken
        });

        const response = await s3.send(command);
        
        if (response.Contents) {
          response.Contents.forEach(object => {
            if (object.Key && this.isImageFile(object.Key)) {
              files.push(object.Key);
            }
          });
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return files;
    } catch (error) {
      this.log(`Error reading S3 files: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if file is an image file
   * @param {string} filename - File name
   * @returns {boolean} True if image file
   */
  isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Delete orphaned files from local storage
   * @param {string[]} orphanedFiles - Array of orphaned file paths
   * @returns {Promise<Object>} Cleanup results
   */
  async deleteLocalOrphanedFiles(orphanedFiles) {
    const results = {
      deleted: 0,
      failed: 0,
      totalSize: 0,
      errors: []
    };

    for (const filePath of orphanedFiles) {
      try {
        const fullPath = path.join(__dirname, '..', filePath);
        
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          results.totalSize += stats.size;
          
          if (!this.dryRun) {
            fs.unlinkSync(fullPath);
          }
          
          results.deleted++;
          this.log(`${this.dryRun ? '[DRY RUN] Would delete' : 'Deleted'}: ${filePath} (${stats.size} bytes)`);
        } else {
          this.log(`File not found: ${filePath}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to delete ${filePath}: ${error.message}`);
        this.log(`Error deleting ${filePath}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Delete orphaned files from S3 storage
   * @param {string[]} orphanedFiles - Array of orphaned S3 keys
   * @returns {Promise<Object>} Cleanup results
   */
  async deleteS3OrphanedFiles(orphanedFiles) {
    const results = {
      deleted: 0,
      failed: 0,
      errors: []
    };

    for (const key of orphanedFiles) {
      try {
        if (!this.dryRun) {
          const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: key
          });
          
          await s3.send(command);
        }
        
        results.deleted++;
        this.log(`${this.dryRun ? '[DRY RUN] Would delete' : 'Deleted'} S3 object: ${key}`);
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to delete ${key}: ${error.message}`);
        this.log(`Error deleting S3 object ${key}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Find and clean orphaned files
   * @param {boolean} dryRun - If true, only simulate cleanup
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanOrphanedFiles(dryRun = false) {
    try {
      this.dryRun = dryRun;
      this.log(`Starting orphaned files cleanup ${dryRun ? '(DRY RUN)' : ''}...`);

      // Get image paths currently in use
      const imagePathsInUse = await this.getImagePathsInUse();

      // Get all files from storage
      let allFiles;
      if (this.storageType === 's3') {
        allFiles = await this.getS3Files();
      } else {
        allFiles = await this.getLocalFiles();
      }

      this.log(`Found ${allFiles.length} total files in storage`);

      // Find orphaned files
      const orphanedFiles = allFiles.filter(filePath => !imagePathsInUse.has(filePath));
      
      this.log(`Found ${orphanedFiles.length} orphaned files`);

      if (orphanedFiles.length === 0) {
        this.log('No orphaned files found. Cleanup complete.');
        return {
          orphanedCount: 0,
          deleted: 0,
          failed: 0,
          totalSize: 0,
          errors: []
        };
      }

      // Delete orphaned files
      let results;
      if (this.storageType === 's3') {
        results = await this.deleteS3OrphanedFiles(orphanedFiles);
      } else {
        results = await this.deleteLocalOrphanedFiles(orphanedFiles);
      }

      const finalResults = {
        orphanedCount: orphanedFiles.length,
        ...results
      };

      this.log(`Cleanup completed. Deleted: ${results.deleted}, Failed: ${results.failed}`);
      
      if (results.totalSize) {
        this.log(`Total space freed: ${(results.totalSize / (1024 * 1024)).toFixed(2)} MB`);
      }

      return finalResults;
    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean empty directories (local storage only)
   * @returns {Promise<number>} Number of directories removed
   */
  async cleanEmptyDirectories() {
    if (this.storageType !== 'local') {
      return 0;
    }

    try {
      this.log('Cleaning empty directories...');
      let removedCount = 0;

      const removeEmptyDirs = (dir) => {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            removeEmptyDirs(fullPath);
            
            // Check if directory is now empty
            if (fs.readdirSync(fullPath).length === 0) {
              if (!this.dryRun) {
                fs.rmdirSync(fullPath);
              }
              removedCount++;
              this.log(`${this.dryRun ? '[DRY RUN] Would remove' : 'Removed'} empty directory: ${fullPath}`);
            }
          }
        });
      };

      removeEmptyDirs(this.uploadsDir);
      
      this.log(`Empty directory cleanup completed. Removed: ${removedCount}`);
      return removedCount;
    } catch (error) {
      this.log(`Error cleaning empty directories: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        filesByType: {},
        storageType: this.storageType
      };

      if (this.storageType === 'local') {
        const walkDir = (dir) => {
          if (!fs.existsSync(dir)) return;

          const items = fs.readdirSync(dir);
          
          items.forEach(item => {
            const fullPath = path.join(dir, item);
            
            if (fs.statSync(fullPath).isDirectory()) {
              walkDir(fullPath);
            } else {
              const fileStats = fs.statSync(fullPath);
              const ext = path.extname(item).toLowerCase();
              
              stats.totalFiles++;
              stats.totalSize += fileStats.size;
              
              if (!stats.filesByType[ext]) {
                stats.filesByType[ext] = { count: 0, size: 0 };
              }
              stats.filesByType[ext].count++;
              stats.filesByType[ext].size += fileStats.size;
            }
          });
        };

        walkDir(this.uploadsDir);
      } else {
        // S3 storage stats would require additional API calls
        this.log('S3 storage stats not implemented yet');
      }

      return stats;
    } catch (error) {
      this.log(`Error getting storage stats: ${error.message}`);
      return null;
    }
  }
}

// Create singleton instance
const fileCleanupService = new FileCleanupService();

/**
 * CLI script for running cleanup
 */
const runCleanupCLI = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const stats = args.includes('--stats') || args.includes('-s');

  try {
    if (stats) {
      console.log('Getting storage statistics...');
      const storageStats = await fileCleanupService.getStorageStats();
      
      if (storageStats) {
        console.log('\nStorage Statistics:');
        console.log(`Total Files: ${storageStats.totalFiles}`);
        console.log(`Total Size: ${(storageStats.totalSize / (1024 * 1024)).toFixed(2)} MB`);
        console.log('\nFiles by Type:');
        
        Object.entries(storageStats.filesByType).forEach(([ext, data]) => {
          console.log(`  ${ext || 'no extension'}: ${data.count} files, ${(data.size / (1024 * 1024)).toFixed(2)} MB`);
        });
      }
      return;
    }

    console.log(`Starting file cleanup ${dryRun ? '(DRY RUN)' : ''}...`);
    
    const results = await fileCleanupService.cleanOrphanedFiles(dryRun);
    
    console.log('\nCleanup Results:');
    console.log(`Orphaned files found: ${results.orphanedCount}`);
    console.log(`Files deleted: ${results.deleted}`);
    console.log(`Failed deletions: ${results.failed}`);
    
    if (results.totalSize) {
      console.log(`Space freed: ${(results.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    }
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(error => console.log(`  ${error}`));
    }

    // Clean empty directories
    const emptyDirsRemoved = await fileCleanupService.cleanEmptyDirectories();
    console.log(`Empty directories removed: ${emptyDirsRemoved}`);
    
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    process.exit(1);
  }
};

// Run CLI if this file is executed directly
if (require.main === module) {
  runCleanupCLI();
}

module.exports = {
  FileCleanupService,
  fileCleanupService,
  runCleanupCLI
};