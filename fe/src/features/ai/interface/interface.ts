export type AIIntentType =
  | 'greeting'
  | 'product_inquiry'
  | 'order_status'
  | 'cooking_tips'
  | 'product_recommendation'
  | 'general'
  | 'error';

export type AIQuerySource = 'text' | 'voice' | 'suggestion' | 'api';

// GET /ai/analytics/intent-distribution → [{ _id, count }]
export interface IntentDistributionItem {
  _id: AIIntentType | string;
  count: number;
}

// GET /ai/analytics/feedback-stats → [{ _id: boolean, count, intents }]
export interface FeedbackStatItem {
  _id: boolean;
  count: number;
  intents?: Array<{ intentType: string; query: string }>;
}

// GET /ai/chat/frequent-queries → [{ query, count, intent_types, last_asked }]
export interface FrequentQueryItem {
  query: string;
  count: number;
  intent_types: string[];
  last_asked: string;
}

// GET /ai/chat/history → { count, history: [...] }
export interface AIChatHistoryItem {
  id: string;
  session_id?: string;
  user_id?: string | null;
  query: string;
  response: string;
  intent_type: AIIntentType | string;
  query_source: AIQuerySource;
  created_at: string;
  response_time?: number;
  feedback?: {
    isHelpful: boolean;
    comments?: string;
    providedAt?: string;
  };
}

export interface AIChatHistoryResponse {
  count: number;
  history: AIChatHistoryItem[];
}
