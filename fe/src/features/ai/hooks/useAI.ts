import { useQuery } from '@tanstack/react-query';
import aiService from '../services/aiService';

export const useIntentDistribution = (params: { startDate?: string; endDate?: string } = {}) =>
  useQuery(
    ['ai', 'intent-distribution', params],
    () => aiService.getIntentDistribution(params),
    { staleTime: 5 * 60 * 1000 }
  );

export const useFeedbackStats = () =>
  useQuery(['ai', 'feedback-stats'], () => aiService.getFeedbackStats(), {
    staleTime: 5 * 60 * 1000,
  });

export const useFrequentQueries = (limit = 10) =>
  useQuery(['ai', 'frequent-queries', limit], () => aiService.getFrequentQueries(limit), {
    staleTime: 5 * 60 * 1000,
  });

export const useChatHistory = (params: { sessionId?: string; userId?: string; limit?: number }) =>
  useQuery(
    ['ai', 'chat-history', params],
    () => aiService.getChatHistory(params),
    { enabled: !!(params.sessionId || params.userId) }
  );
