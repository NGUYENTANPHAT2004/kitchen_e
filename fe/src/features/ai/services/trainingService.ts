import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api } from "../../../config/api_cli.config";

export interface Intent {
  id?: string; key: string; label: string;
  handler: "response" | "products" | "recommendations" | "orders" | "recipes";
  response: string; enabled: boolean;
  trainCount?: number; validationCount?: number; pendingCount?: number;
}
export interface Example {
  id: string; text: string; intent: string; purpose: "train" | "validation";
  approved: boolean; sourceLogId?: string; source?: string;
}
export type ExampleInput = Pick<Example, "text" | "intent" | "purpose" | "approved">;
export interface TrainingSettings {
  autoTrain: boolean; minChanges: number; intervalMinutes: number; minF1: number; minConfidence: number;
}
export interface ModelVersion {
  id: string; name: string; status: "running" | "ready" | "failed";
  trigger: "manual" | "automatic"; createdAt: string; error?: string; activationNote?: string;
  metrics?: {
    accuracy: number; macroF1: number; trainingSamples: number; validationSamples: number;
    perIntent: { intent: string; precision: number; recall: number; "f1-score": number; support: number }[];
    mistakes: { text: string; actual: string; predicted: string }[];
  };
}
export interface TrainingStatus {
  settings: TrainingSettings; versions: ModelVersion[]; activeVersionId: string | null;
  runningJobId: string | null; trainingSamples: number; validationSamples: number;
  pendingSamples: number; pendingChanges: number; lastRunAt?: string; artifactError?: string;
}
export interface Pagination { currentPage: number; totalPages: number; totalItems: number; limit: number }
export interface Conversation {
  sessionId: string; userId?: string | null; user?: { firstName?: string; lastName?: string; username?: string };
  title: string; lastQuery: string; lastResponse: string; lastIntent: string; messageCount: number;
  lastAt: string; negativeFeedback: number;
}
export const aiGet = async <T,>(path: string, params?: Record<string, unknown>): Promise<T> =>
  (await api.get<{ data: T }>(`/ai${path}`, { params })).data.data;
export const aiError = (error: unknown): string => {
  const data = isAxiosError(error) ? error.response?.data : undefined;
  const message = data?.message || (typeof data?.error === "string" ? data.error : data?.error?.message);
  return typeof message === "string" && message.trim() ? message : "Không thể thực hiện. Vui lòng thử lại.";
};
export const useIntents = () => useQuery({ queryKey: ["ai", "intents"], queryFn: () => aiGet<{ intents: Intent[] }>("/training/intents") });
export const useTrainingStatus = () => useQuery({
  queryKey: ["ai", "training"], queryFn: () => aiGet<TrainingStatus>("/training/status"),
  refetchInterval: data => data?.runningJobId ? 2000 : 15000,
});
export const percent = (value?: number) => value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
export const aiDate = (value?: string) => value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
