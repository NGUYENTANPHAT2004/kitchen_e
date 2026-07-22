// services/ai.service.js
const axios = require('axios');
const config = require('../config/default');

/**
 * Service for interacting with Python AI microservice
 */
class AIService {
  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || config.pythonAIServiceURL;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Process a chat message with the AI assistant
   * @param {string} message - User's message
   * @param {string} userId - User ID (optional)
   * @param {string} sessionId - Session ID (optional)
   * @param {string} language - Language code (default: 'vi')
   * @returns {Promise<Object>} - AI response
   */
  async processChat(message, userId = null, sessionId = null, language = 'vi') {
    try {
      const response = await this.axiosInstance.post('/api/chat/message', {
        message,
        user_id: userId,
        session_id: sessionId,
        language
      });
      
      return response.data;
    } catch (error) {
      console.error('Error processing chat message:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get personalized product recommendations for a user
   * @param {string} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Product recommendations
   */
  async getPersonalizedRecommendations(userId, options = {}) {
    try {
      const response = await this.axiosInstance.get(`/api/recommendations/products/personalized/${userId}`, {
        params: {
          limit: options.limit || 10,
          include_viewed: options.includeViewed || false
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting personalized recommendations:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get similar products to a given product
   * @param {string} productId - Product ID
   * @param {number} limit - Number of similar products to return
   * @returns {Promise<Object>} - Similar products
   */
  async getSimilarProducts(productId, limit = 10) {
    try {
      const response = await this.axiosInstance.get(`/api/recommendations/products/similar/${productId}`, {
        params: { limit }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting similar products:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Process a face authentication request
   * @param {Buffer} faceImageBuffer - Face image buffer
   * @returns {Promise<Object>} - Authentication result
   */
  async authenticateFace(faceImageBuffer) {
    try {
      // Create form data
      const formData = new FormData();
      const blob = new Blob([faceImageBuffer], { type: 'image/jpeg' });
      formData.append('face_image', blob, 'face.jpg');
      
      // Custom headers for form data
      const headers = {
        'Content-Type': 'multipart/form-data'
      };
      
      const response = await this.axiosInstance.post('/api/face-auth/authenticate', formData, { headers });
      return response.data;
    } catch (error) {
      console.error('Error authenticating face:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Register a user's face for future authentication
   * @param {string} userId - User ID
   * @param {Buffer} faceImageBuffer - Face image buffer
   * @param {boolean} overrideExisting - Whether to override existing face data
   * @returns {Promise<Object>} - Registration result
   */
  async registerFace(userId, faceImageBuffer, overrideExisting = false) {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('override_existing', overrideExisting);
      
      const blob = new Blob([faceImageBuffer], { type: 'image/jpeg' });
      formData.append('face_image', blob, 'face.jpg');
      
      // Custom headers for form data
      const headers = {
        'Content-Type': 'multipart/form-data'
      };
      
      const response = await this.axiosInstance.post('/api/face-auth/register', formData, { headers });
      return response.data;
    } catch (error) {
      console.error('Error registering face:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get recipe recommendations based on a product
   * @param {string} productId - Product ID
   * @param {number} limit - Number of recipes to return
   * @returns {Promise<Object>} - Recipe recommendations
   */
  async getRecipeRecommendations(productId, limit = 5) {
    try {
      const response = await this.axiosInstance.get(`/api/recipes/by-product/${productId}`, {
        params: { limit }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting recipe recommendations:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Process speech to text and get AI response
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {string} userId - User ID (optional)
   * @param {string} sessionId - Session ID (optional)
   * @param {boolean} respondWithVoice - Whether to respond with voice
   * @returns {Promise<Object>} - Recognition and response
   */
  async processSpeech(audioBuffer, userId = null, sessionId = null, respondWithVoice = false) {
    try {
      // Create form data
      const formData = new FormData();
      if (userId) formData.append('user_id', userId);
      if (sessionId) formData.append('session_id', sessionId);
      formData.append('respond_with_voice', respondWithVoice);
      
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('audio_file', blob, 'speech.wav');
      
      // Custom headers for form data
      const headers = {
        'Content-Type': 'multipart/form-data'
      };
      
      const response = await this.axiosInstance.post('/api/speech/recognize-and-respond', formData, { headers });
      return response.data;
    } catch (error) {
      console.error('Error processing speech:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get user insights based on behavior analysis
   * @param {string} userId - User ID
   * @param {boolean} refresh - Whether to refresh insights
   * @returns {Promise<Object>} - User insights
   */
  async getUserInsights(userId, refresh = false) {
    try {
      const response = await this.axiosInstance.get(`/api/user-behavior/insights/${userId}`, {
        params: { refresh }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting user insights:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Log user activity for behavior analysis
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} activityType - Activity type
   * @param {Object} data - Activity data
   * @returns {Promise<Object>} - Log result
   */
  async logUserActivity(userId, sessionId, activityType, data) {
    try {
      const response = await this.axiosInstance.post('/api/user-behavior/log-activity', {
        user_id: userId,
        session_id: sessionId,
        activity_type: activityType,
        data
      });
      
      return response.data;
    } catch (error) {
      console.error('Error logging user activity:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Handle API errors
   * @private
   * @param {Error} error - Axios error
   * @returns {Error} - Formatted error
   */
  _handleError(error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const errorData = error.response.data;
      const errorMessage = errorData.error?.message || 'Unknown API error';
      const errorCode = errorData.error?.code || 'unknown_error';
      
      const apiError = new Error(errorMessage);
      apiError.statusCode = error.response.status;
      apiError.errorCode = errorCode;
      apiError.details = errorData.error?.details;
      
      return apiError;
    } else if (error.request) {
      // The request was made but no response was received
      const networkError = new Error('No response from AI service. Please check if the service is running.');
      networkError.statusCode = 503;
      networkError.errorCode = 'network_error';
      
      return networkError;
    } else {
      // Something happened in setting up the request that triggered an Error
      return error;
    }
  }
}

module.exports = new AIService();