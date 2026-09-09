import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import RequestState from "../../../../components/shared/RequestState";
import { api } from "../../../../config/api_cli.config";
import { aiError, useIntents } from "../../services/trainingService";
import type { Intent } from "../../services/trainingService";

const blank: Intent = { key: "", label: "", handler: "response", response: "", enabled: true };
const handlers = { response: "Câu trả lời đã duyệt", products: "Tìm sản phẩm trong cửa hàng", recommendations: "Gợi ý sản phẩm", orders: "Hướng dẫn xem đơn hàng", recipes: "Tìm công thức đã xuất bản" };
export default function AIIntentPanel() {
  const query = useIntents();
  const client = useQueryClient();
  const [form, setForm] = useState<Intent | null>(null);
  const [editing, setEditing] = useState(false);
  const save = useMutation({ mutationFn: async (value: Intent) => {
    const body = { key: value.key, label: value.label, handler: value.handler, response: value.response, enabled: value.enabled };
    return editing ? api.put(`/ai/training/intents/${value.key}`, body) : api.post("/ai/training/intents", body);
  }, onSuccess: () => { setForm(null); client.invalidateQueries(["ai"]); toast.success("Đã lưu intent. Huấn luyện lại để áp dụng nội dung mới."); } });
  const remove = useMutation({ mutationFn: (key: string) => api.delete(`/ai/training/intents/${key}`), onSuccess: () => { client.invalidateQueries(["ai"]); toast.success("Đã xóa intent."); } });
  if (query.isLoading || query.isError) return <RequestState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} />;
  return <section className="ai-card">
    <div className="ai-section-title"><div><h2>Quản lý intent</h2><p>Intent là nhóm ý định của khách: tìm sản phẩm, đổi trả, hỏi cách nấu… Tắt intent sẽ ngừng dùng ngay; thay đổi câu trả lời cần huấn luyện lại.</p></div><button className="button" onClick={() => { setForm({ ...blank }); setEditing(false); save.reset(); }}><Plus size={16} /> Thêm intent</button></div>
    {form && <form className="ai-editor" onSubmit={e => { e.preventDefault(); save.mutate(form); }}>
      <h3>{editing ? "Chỉnh sửa intent" : "Intent mới"}</h3>
      <div className="ai-form-grid">
        <label className="field">Tên hiển thị<input required maxLength={100} minLength={2} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label>
        <label className="field">Mã intent<input required pattern="[a-z][a-z0-9_]{1,59}" disabled={editing} placeholder="vi_du: bao_hanh" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} /><small>Chữ thường không dấu, số và dấu gạch dưới.</small></label>
        <label className="field">Cách trả lời<select value={form.handler} onChange={e => setForm({ ...form, handler: e.target.value as Intent["handler"] })}>{Object.entries(handlers).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="check-label"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Bật intent</label>
      </div>
      {form.handler === "response" && <label className="field">Câu trả lời cho khách<textarea required maxLength={2000} rows={4} value={form.response} onChange={e => setForm({ ...form, response: e.target.value })} /></label>}
      {save.isError && <p role="alert" className="ai-error">{aiError(save.error)}</p>}
      <div className="ai-actions"><button className="button" disabled={save.isLoading}>Lưu intent</button><button type="button" className="button secondary" disabled={save.isLoading} onClick={() => setForm(null)}>Hủy</button></div>
    </form>}
    {remove.isError && <p role="alert" className="ai-error">{aiError(remove.error)}</p>}
    <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Intent</th><th>Cách trả lời</th><th>Câu học / kiểm tra</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {query.data?.intents.map(item => <tr key={item.key}><td><b>{item.label}</b><small>{item.key}</small></td><td>{handlers[item.handler]}</td><td>{item.trainCount} / {item.validationCount}{item.enabled && ((item.trainCount ?? 0) < 3 || (item.validationCount ?? 0) < 2) && <small className="ai-error">Cần thêm câu mẫu</small>}</td><td><span className={`ai-badge ${item.enabled ? "" : "inactive"}`}>{item.enabled ? "Đang bật" : "Đã tắt"}</span></td><td><div className="ai-actions"><button className="icon-button" aria-label={`Sửa ${item.label}`} onClick={() => { setForm({ ...item }); setEditing(true); save.reset(); }}><Pencil size={16} /></button><button className="icon-button" aria-label={`Xóa ${item.label}`} disabled={remove.isLoading} onClick={() => { if (window.confirm(`Xóa intent “${item.label}”? Intent còn câu mẫu cần được tắt hoặc xóa câu mẫu trước.`)) remove.mutate(item.key); }}><Trash2 size={16} /></button></div></td></tr>)}
    </tbody></table></div>
    {!query.data?.intents.length && <RequestState empty="Chưa có intent. Thêm nhóm câu hỏi đầu tiên của bạn." />}
  </section>;
}
