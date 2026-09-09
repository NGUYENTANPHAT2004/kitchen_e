import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, LoaderCircle, Plus, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link } from "react-router-dom";
import { api, urlUtils } from "../../../../config/api_cli.config";
import { useAuth } from "../../../auth/hooks/auth-hook";
import RequestState from "../../../../components/shared/RequestState";
import { aiError, aiGet } from "../../services/trainingService";
import type { AIChatHistoryItem, AIChatHistoryResponse } from "../../interface/interface";
import "../../ai.css";

interface Session { id: string; token: string }
interface Reply {
  session_id: string; session_token: string; log_id: string; response: string; intent_type: string;
  suggested_products?: AIChatHistoryItem["suggested_products"];
  suggested_recipes?: AIChatHistoryItem["suggested_recipes"];
  suggested_actions?: AIChatHistoryItem["suggested_actions"];
}
const actionPaths: Record<string, string> = { view_new_products: "/shop/category/all", view_bestsellers: "/shop/category/all", find_recipes: "/shop/recipes", view_promotions: "/shop/account/vouchers", track_order: "/shop/account/orders", contact_support: "/shop/support" };
function readSession(key: string): Session | null {
  try { const value = JSON.parse(sessionStorage.getItem(key) || "null"); return typeof value?.id === "string" && typeof value?.token === "string" ? value : null; } catch { return null; }
}

function Conversation({ storageKey, compact }: { storageKey: string; compact?: boolean }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(() => readSession(storageKey));
  const [restored, setRestored] = useState(!session);
  const [messages, setMessages] = useState<AIChatHistoryItem[]>([]);
  const [input, setInput] = useState("");
  const inputId = useId();
  const log = useRef<HTMLDivElement>(null);
  const status = useQuery({ queryKey: ["ai", "public-status"], queryFn: () => aiGet<{ enabled: boolean; connected: boolean }>("/status"), staleTime: 15000, refetchInterval: 30000 });
  const history = useQuery({ queryKey: ["ai", "customer-history", storageKey, session?.id], enabled: !!session && !restored, retry: false, cacheTime: 0,
    queryFn: async () => (await api.get<{ data: AIChatHistoryResponse }>("/ai/chat/history", { params: { sessionId: session?.id, limit: 100 }, headers: { "X-Chat-Token": session?.token } })).data.data,
  });
  useEffect(() => {
    if (history.data && !restored) { setMessages([...history.data.history].reverse()); setRestored(true); }
  }, [history.data, restored]);
  const chat = useMutation({ mutationFn: async (message: string) => (await api.post<{ data: Reply }>("/ai/chat", { message, ...(session ? { sessionId: session.id, sessionToken: session.token } : {}) })).data.data,
    onSuccess: (reply, query) => {
      const next = { id: reply.session_id, token: reply.session_token };
      setSession(next); setRestored(true);
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Chat remains usable without persistence. */ }
      setMessages(previous => [...previous, { id: reply.log_id, query, response: reply.response, intent_type: reply.intent_type, query_source: "text", created_at: new Date().toISOString(), suggested_products: reply.suggested_products, suggested_recipes: reply.suggested_recipes, suggested_actions: reply.suggested_actions }]);
      setInput(""); client.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
  const feedback = useMutation({ mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) => api.post(`/ai/feedback/${id}`, { isHelpful: helpful, sessionToken: session?.token }), onSuccess: (_data, value) => setMessages(previous => previous.map(item => item.id === value.id ? { ...item, feedback: { isHelpful: value.helpful } } : item)) });
  useEffect(() => { const element = log.current; if (element) element.scrollTop = element.scrollHeight; }, [messages, chat.isLoading]);
  const reset = () => { setMessages([]); setSession(null); setRestored(true); setInput(""); chat.reset(); feedback.reset(); try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ } };
  if (status.isLoading || status.isError) return <RequestState loading={status.isLoading} error={status.isError} retry={() => status.refetch()} />;
  const ready = status.data?.enabled && status.data.connected;
  return <section className={`ai-chat ${compact ? "compact" : ""}`} aria-label="Trợ lý Kitchen E">
    <div className="ai-chat-header"><div className="ai-actions"><Bot size={23} /><div><h2>Trợ lý Kitchen E</h2><span>{ready ? "Sẵn sàng hỗ trợ" : "Tạm thời chưa sẵn sàng"}</span></div></div><button className="icon-button" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới" disabled={chat.isLoading} onClick={reset}><Plus size={20} /></button></div>
    {!ready && <div role="status" className="ai-chat-offline">Trợ lý đang tạm nghỉ. <button onClick={() => status.refetch()}>Kết nối lại</button> hoặc <Link to="/shop/support">liên hệ cửa hàng</Link>.</div>}
    <div className="ai-chat-messages" ref={log} role="log" aria-label="Cuộc trò chuyện với trợ lý" aria-live="polite">
      {!restored && (history.isLoading || history.isError) && <RequestState loading={history.isLoading} error={history.isError} retry={() => history.refetch()} />}
      {restored && !messages.length && <div className="ai-chat-welcome"><Bot size={38} strokeWidth={1.4} /><h3>Bạn cần gì cho căn bếp?</h3><div className="ai-prompts">{["Tư vấn chảo chống dính", "Máy xay dưới 1 triệu", "Tìm công thức nấu ăn", "Đơn hàng của tôi"].map(prompt => <button type="button" key={prompt} disabled={!ready || chat.isLoading} onClick={() => setInput(prompt)}>{prompt}</button>)}</div></div>}
      {messages.map(message => <div className="ai-chat-turn" key={message.id}><p className="ai-user-bubble">{message.query}</p><div className="ai-assistant-bubble"><p>{message.response}</p>
        {!!message.suggested_products?.length && <div className="ai-chat-products">{message.suggested_products.map(product => <Link to={`/shop/product/${product.id}`} key={product.id} className="ai-chat-product"><img src={urlUtils.getFullImageUrl(product.image) || urlUtils.getFallbackImageUrl()} alt={product.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = urlUtils.getFallbackImageUrl(); }} /><span><strong>{product.name}</strong><b>{product.price.toLocaleString("vi-VN")} ₫</b></span></Link>)}</div>}
        {!!message.suggested_recipes?.length && <div className="ai-chat-recipes">{message.suggested_recipes.map(recipe => <Link to={`/shop/recipes/${recipe.id}`} key={recipe.id}>{recipe.title}</Link>)}</div>}
        <div className="ai-chat-links">{message.suggested_actions?.filter(action => actionPaths[action.action]).map(action => <Link key={action.action} to={actionPaths[action.action]}>{action.text}</Link>)}</div>
        <div className="ai-feedback" aria-label="Đánh giá câu trả lời"><button title="Hữu ích" aria-label="Câu trả lời hữu ích" aria-pressed={message.feedback?.isHelpful === true} disabled={feedback.isLoading} onClick={() => feedback.mutate({ id: message.id, helpful: true })}><ThumbsUp size={15} /></button><button title="Chưa hữu ích" aria-label="Câu trả lời chưa hữu ích" aria-pressed={message.feedback?.isHelpful === false} disabled={feedback.isLoading} onClick={() => feedback.mutate({ id: message.id, helpful: false })}><ThumbsDown size={15} /></button>{typeof message.feedback?.isHelpful === "boolean" && <span>Đã ghi nhận</span>}</div>
      </div></div>)}
      {chat.isLoading && <p role="status" className="ai-actions ai-muted"><LoaderCircle size={16} className="animate-spin" /> Trợ lý đang trả lời…</p>}
    </div>
    <form className="ai-chat-composer" onSubmit={e => { e.preventDefault(); if (ready && restored && input.trim() && !chat.isLoading) chat.mutate(input.trim()); }}>
      {(chat.isError || feedback.isError) && <p role="alert" className="ai-error">{aiError(chat.error || feedback.error)}</p>}
      <label className="sr-only" htmlFor={inputId}>Tin nhắn cho trợ lý</label><div><textarea id={inputId} rows={2} value={input} maxLength={2000} onChange={e => setInput(e.target.value)} disabled={!ready || !restored || chat.isLoading} placeholder="Nhập câu hỏi của bạn…" /><button className="button" title="Gửi tin nhắn" aria-label="Gửi tin nhắn" disabled={!ready || !restored || !input.trim() || chat.isLoading}><Send size={19} /></button></div>
      <small>Giá và tình trạng sản phẩm được xác nhận tại trang sản phẩm.</small>
    </form>
  </section>;
}

export default function AIChatPanel({ compact = false }: { compact?: boolean }) {
  const { state } = useAuth();
  if (state.loading) return <RequestState loading />;
  const key = `kitchen-ai-session:${state.user?._id || "guest"}`;
  return <Conversation key={key} storageKey={key} compact={compact} />;
}
