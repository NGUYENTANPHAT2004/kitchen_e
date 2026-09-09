import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, ThumbsDown } from "lucide-react";
import toast from "react-hot-toast";
import RequestState from "../../../../components/shared/RequestState";
import { api } from "../../../../config/api_cli.config";
import { aiDate, aiError, aiGet, percent, useIntents } from "../../services/trainingService";
import type { Conversation, ExampleInput, Pagination } from "../../services/trainingService";
import type { AIChatHistoryItem, AIChatHistoryResponse } from "../../interface/interface";
import { ExampleFields } from "./AIExamplesPanel";

function LabelQuery({ log, close }: { log: AIChatHistoryItem; close: () => void }) {
  const intents = useIntents();
  const client = useQueryClient();
  const [form, setForm] = useState<ExampleInput>({ text: log.query, intent: "", purpose: "train", approved: false });
  const save = useMutation({ mutationFn: () => api.post(`/ai/admin/logs/${log.id}/training-example`, { intent: form.intent, purpose: form.purpose, approved: form.approved }), onSuccess: () => { client.invalidateQueries(["ai"]); toast.success("Đã đưa câu hỏi vào dữ liệu huấn luyện."); close(); } });
  return <form className="ai-editor" onSubmit={e => { e.preventDefault(); save.mutate(); }}><h3>Gán nhãn câu hỏi</h3><p>“{log.query}”</p><ExampleFields fixedText form={form} onChange={setForm} intents={intents.data?.intents || []} />
    {intents.isError && <RequestState error retry={() => intents.refetch()} />}
    {save.isError && <p role="alert" className="ai-error">{aiError(save.error)}</p>}
    <div className="ai-actions"><button className="button" disabled={!form.intent || save.isLoading}>Thêm vào dữ liệu</button><button className="button secondary" type="button" disabled={save.isLoading} onClick={close}>Hủy</button></div>
  </form>;
}

export default function AIConversationsPanel() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [label, setLabel] = useState<AIChatHistoryItem | null>(null);
  const query = useQuery({ queryKey: ["ai", "conversations", filter, page], queryFn: () => aiGet<{ conversations: Conversation[]; pagination: Pagination }>("/admin/conversations", { search: filter, page, limit: 12 }) });
  const history = useQuery({ queryKey: ["ai", "history", selected?.sessionId], queryFn: () => aiGet<AIChatHistoryResponse>("/chat/history", { sessionId: selected?.sessionId, limit: 100 }), enabled: !!selected });
  if (selected) return <section className="ai-card"><button className="button secondary" onClick={() => { setSelected(null); setLabel(null); }}><ArrowLeft size={16} /> Danh sách hội thoại</button><div className="ai-section-title"><div><h2>{selected.title}</h2><p>{selected.user?.username || "Khách vãng lai"} · {selected.messageCount} lượt hỏi · {aiDate(selected.lastAt)}</p></div></div>
    {history.isLoading || history.isError ? <RequestState loading={history.isLoading} error={history.isError} retry={() => history.refetch()} /> : <>
      {selected.messageCount > 100 && <p className="ai-notice">Đang hiển thị 100 lượt gần nhất.</p>}
      {[...(history.data?.history || [])].reverse().map(log => <article className="ai-log-entry" key={log.id}><div className="ai-actions ai-muted"><time>{aiDate(log.created_at)}</time><span>{log.intent_type}</span>{log.intent_confidence != null && <span>Độ tin cậy {percent(log.intent_confidence)}</span>}{log.feedback?.isHelpful === false && <span className="ai-error"><ThumbsDown size={14} /> Chưa hữu ích</span>}</div><p><b>Khách:</b> {log.query}</p><p className="ai-log-answer"><b>Trợ lý:</b> {log.response}</p><button className="button secondary" onClick={() => setLabel(log)}><Plus size={14} /> Gán nhãn để huấn luyện</button>{label?.id === log.id && <LabelQuery key={log.id} log={log} close={() => setLabel(null)} />}</article>)}
      {!history.data?.history.length && <RequestState empty="Hội thoại chưa có nội dung." />}
    </>}
  </section>;
  return <section className="ai-card"><div className="ai-section-title"><div><h2>Hội thoại khách hàng</h2><p>Xem nội dung thực tế và chọn câu hỏi cần bổ sung vào dữ liệu huấn luyện.</p></div></div>
    <form className="ai-search" onSubmit={e => { e.preventDefault(); setFilter(search.trim()); setPage(1); }}><input aria-label="Tìm hội thoại" placeholder="Tìm trong câu hỏi, câu trả lời…" maxLength={200} value={search} onChange={e => setSearch(e.target.value)} /><button className="button secondary"><Search size={16} /> Tìm</button></form>
    {query.isLoading || query.isError ? <RequestState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} /> : <>
      {query.data?.conversations.map(item => <button type="button" className="ai-conversation-row" key={`${item.sessionId}:${item.userId || "guest"}`} onClick={() => setSelected(item)}><span className="ai-conversation-main"><strong>{item.title}</strong><span>{item.lastResponse}</span><small>{item.user?.username || "Khách vãng lai"} · {item.messageCount} lượt hỏi{item.negativeFeedback > 0 && ` · ${item.negativeFeedback} phản hồi chưa hữu ích`}</small></span><time>{aiDate(item.lastAt)}</time></button>)}
      {!query.data?.conversations.length && <RequestState empty={filter ? "Không có hội thoại phù hợp." : "Chưa có hội thoại. Khách có thể bắt đầu từ trợ lý trên cửa hàng."} />}
      <div className="ai-pagination"><span>{query.data?.pagination.totalItems} hội thoại · Trang {page}/{query.data?.pagination.totalPages}</span><div className="ai-actions"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><button className="button secondary" disabled={page >= (query.data?.pagination.totalPages || 1)} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    </>}
  </section>;
}
