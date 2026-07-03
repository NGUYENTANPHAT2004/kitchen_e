import { api, endpoints } from '../../../config/api_cli.config';
import type {
  IntentDistributionItem,
  FeedbackStatItem,
  FrequentQueryItem,
  AIChatHistoryResponse,
} from '../interface/interface';

const aiService = {
  // GET /ai/analytics/intent-distribution (admin) → data is an array
  async getIntentDistribution(params: { startDate?: string; endDate?: string } = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    const response = await api.get(`${endpoints.ai.intentDistribution}${qs ? `?${qs}` : ''}`);
    return (response.data?.data ?? response.data ?? []) as IntentDistributionItem[];
  },

  // GET /ai/analytics/feedback-stats (admin) → data is an array
  async getFeedbackStats() {
    const response = await api.get(endpoints.ai.feedbackStats);
    return (response.data?.data ?? response.data ?? []) as FeedbackStatItem[];
  },

  // GET /ai/chat/frequent-queries (admin) → data is an array
  async getFrequentQueries(limit = 10) {
    const response = await api.get(`${endpoints.ai.frequentQueries}?limit=${limit}`);
    return (response.data?.data ?? response.data ?? []) as FrequentQueryItem[];
  },

  // GET /ai/chat/history?sessionId=... | userId=...
  async getChatHistory(params: { sessionId?: string; userId?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params.sessionId) query.set('sessionId', params.sessionId);
    if (params.userId) query.set('userId', params.userId);
    if (params.limit) query.set('limit', String(params.limit));
    const response = await api.get(`${endpoints.ai.chatHistory}?${query.toString()}`);
    return (response.data?.data ?? response.data) as AIChatHistoryResponse;
  },
};

export default aiService;
