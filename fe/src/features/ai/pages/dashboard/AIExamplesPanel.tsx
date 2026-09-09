import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import RequestState from "../../../../components/shared/RequestState";
import { api } from "../../../../config/api_cli.config";
import { aiError, aiGet, useIntents } from "../../services/trainingService";
import type { Example, ExampleInput, Intent, Pagination } from "../../services/trainingService";

export function ExampleFields({ form, onChange, intents, fixedText = false }: { form: ExampleInput; onChange: (value: ExampleInput) => void; intents: Intent[]; fixedText?: boolean }) {
  return <>
    {!fixedText && <label className="field">Câu hỏi mẫu<textarea required minLength={2} maxLength={2000} rows={3} placeholder="Ví dụ: Tôi muốn tìm chảo dùng được cho bếp từ" value={form.text} onChange={e => onChange({ ...form, text: e.target.value })} /></label>}
    <div className="ai-form-grid"><label className="field">Nhãn intent<select required value={form.intent} onChange={e => onChange({ ...form, intent: e.target.value })}><option value="">Chọn nhãn đúng</option>{intents.map(item => <option value={item.key} key={item.key}>{item.label}{!item.enabled ? " (đã tắt)" : ""}</option>)}</select></label>
      <label className="field">Dùng cho<select value={form.purpose} onChange={e => onChange({ ...form, purpose: e.target.value as ExampleInput["purpose"] })}><option value="train">Tập học</option><option value="validation">Tập kiểm tra riêng</option></select></label></div>
    <label className="check-label"><input type="checkbox" checked={form.approved} onChange={e => onChange({ ...form, approved: e.target.checked })} /> Tôi đã kiểm tra câu hỏi và nhãn, duyệt để sử dụng</label>
  </>;
}

export default function AIExamplesPanel() {
  const intents = useIntents();
  const client = useQueryClient();
  const [intent, setIntent] = useState("");
  const [approval, setApproval] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<(ExampleInput & { id?: string }) | null>(null);
  const query = useQuery({ queryKey: ["ai", "examples", intent, approval, page], queryFn: () => aiGet<{ examples: Example[]; pagination: Pagination }>("/training/examples", { page, limit: 15, intent: intent || undefined, approved: approval || undefined }) });
  const save = useMutation({ mutationFn: (value: ExampleInput & { id?: string }) => {
    const body = { text: value.text, intent: value.intent, purpose: value.purpose, approved: value.approved };
    return value.id ? api.put(`/ai/training/examples/${value.id}`, body) : api.post("/ai/training/examples", body);
  }, onSuccess: () => { client.invalidateQueries(["ai"]); setForm(null); toast.success("Đã lưu câu mẫu."); } });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/ai/training/examples/${id}`), onSuccess: () => { client.invalidateQueries(["ai"]); if (query.data?.examples.length === 1 && page > 1) setPage(page - 1); } });
  return <section className="ai-card"><div className="ai-section-title"><div><h2>Dữ liệu huấn luyện</h2><p>Câu mẫu gán nhãn đúng giúp model hiểu các cách hỏi khác nhau. Giữ tập kiểm tra độc lập; câu trùng sẽ bị từ chối.</p></div><button className="button" onClick={() => { setForm({ text: "", intent, purpose: "train", approved: false }); save.reset(); }}><Plus size={16} /> Thêm câu mẫu</button></div>
    {form && <form className="ai-editor" onSubmit={e => { e.preventDefault(); save.mutate(form); }}><h3>{form.id ? "Chỉnh sửa câu mẫu" : "Câu mẫu mới"}</h3><ExampleFields form={form} onChange={value => setForm({ ...form, ...value })} intents={intents.data?.intents || []} />
      {intents.isError && <p role="alert" className="ai-error">Không tải được danh sách intent. <button type="button" onClick={() => intents.refetch()}>Thử lại</button></p>}
      {save.isError && <p role="alert" className="ai-error">{aiError(save.error)}</p>}
      <div className="ai-actions"><button className="button" disabled={save.isLoading || !form.intent}>Lưu câu mẫu</button><button type="button" className="button secondary" disabled={save.isLoading} onClick={() => setForm(null)}>Hủy</button></div>
    </form>}
    <div className="ai-filters"><label className="field">Lọc theo intent<select value={intent} onChange={e => { setIntent(e.target.value); setPage(1); }}><option value="">Tất cả intent</option>{intents.data?.intents.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="field">Duyệt dữ liệu<select value={approval} onChange={e => { setApproval(e.target.value); setPage(1); }}><option value="">Tất cả câu mẫu</option><option value="false">Chờ duyệt</option><option value="true">Đã duyệt</option></select></label></div>
    {(save.isError && !form || remove.isError) && <p role="alert" className="ai-error">{aiError(remove.error || save.error)}</p>}
    {query.isLoading || query.isError ? <RequestState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} /> : <>
      <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Câu hỏi</th><th>Nhãn</th><th>Tập dữ liệu</th><th>Duyệt</th><th>Thao tác</th></tr></thead><tbody>{query.data?.examples.map(item => <tr key={item.id}><td className="ai-example-text">{item.text}{item.sourceLogId && <small>Từ hội thoại thực tế</small>}</td><td>{intents.data?.intents.find(label => label.key === item.intent)?.label || item.intent}</td><td>{item.purpose === "train" ? "Tập học" : "Kiểm tra"}</td><td><span className={`ai-badge ${item.approved ? "" : "inactive"}`}>{item.approved ? "Đã duyệt" : "Chờ duyệt"}</span></td><td><div className="ai-actions">{!item.approved && <button className="icon-button" aria-label={`Duyệt câu ${item.text}`} disabled={save.isLoading} onClick={() => { setForm({ ...item, approved: true }); save.reset(); }}><Check size={16} /></button>}<button className="icon-button" aria-label={`Sửa câu ${item.text}`} onClick={() => { setForm({ ...item }); save.reset(); }}><Pencil size={16} /></button><button className="icon-button" aria-label={`Xóa câu ${item.text}`} disabled={remove.isLoading} onClick={() => { if (window.confirm("Xóa câu mẫu này khỏi dữ liệu huấn luyện?")) remove.mutate(item.id); }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>
      {!query.data?.examples.length && <RequestState empty="Không có câu mẫu phù hợp với bộ lọc." />}
      <div className="ai-pagination"><span>{query.data?.pagination.totalItems} câu mẫu · Trang {page}/{query.data?.pagination.totalPages}</span><div className="ai-actions"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><button className="button secondary" disabled={page >= (query.data?.pagination.totalPages || 1)} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    </>}
  </section>;
}
