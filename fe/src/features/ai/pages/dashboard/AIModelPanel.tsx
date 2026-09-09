import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Cpu, LoaderCircle, Play, RefreshCw, Save } from "lucide-react";
import toast from "react-hot-toast";
import RequestState from "../../../../components/shared/RequestState";
import { api } from "../../../../config/api_cli.config";
import { aiDate, aiError, percent, useTrainingStatus } from "../../services/trainingService";
import type { ModelVersion, TrainingSettings } from "../../services/trainingService";

function AutoTrainingForm({ initial }: { initial: TrainingSettings }) {
  const [form, setForm] = useState(initial);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.put("/ai/training/settings", form),
    onSuccess: () => { client.invalidateQueries(["ai", "training"]); toast.success("Đã lưu lịch huấn luyện."); },
  });
  return <form className="ai-card" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <div className="ai-section-title"><div><h2>Huấn luyện tự động</h2><p>Chỉ học từ câu đã được duyệt. Phản hồi của khách cần được bạn gán nhãn trước.</p></div></div>
    <label className="check-label"><input type="checkbox" checked={form.autoTrain} onChange={e => setForm({ ...form, autoTrain: e.target.checked })} /> Tự huấn luyện khi dữ liệu thay đổi</label>
    <div className="ai-form-grid">
      <label className="field">Số thay đổi tối thiểu<input type="number" min={1} max={1000} required value={form.minChanges} onChange={e => setForm({ ...form, minChanges: Number(e.target.value) })} /></label>
      <label className="field">Khoảng cách giữa hai lượt (phút)<input type="number" min={1} max={10080} required value={form.intervalMinutes} onChange={e => setForm({ ...form, intervalMinutes: Number(e.target.value) })} /></label>
      <label className="field">F1 tối thiểu để kích hoạt (%)<input type="number" min={50} max={100} step={1} required value={Math.round(form.minF1 * 100)} onChange={e => setForm({ ...form, minF1: Number(e.target.value) / 100 })} /></label>
      <label className="field">Độ tin cậy tối thiểu khi trả lời (%)<input type="number" min={20} max={95} step={1} required value={Math.round(form.minConfidence * 100)} onChange={e => setForm({ ...form, minConfidence: Number(e.target.value) / 100 })} /></label>
    </div>
    <p className="ai-muted">Phiên bản tự động chỉ thay model đang dùng nếu đạt ngưỡng, không giảm F1 và giữ nguyên tập kiểm tra. Trường hợp khác sẽ chờ bạn xem xét.</p>
    {save.isError && <p role="alert" className="ai-error">{aiError(save.error)}</p>}
    <button className="button secondary" disabled={save.isLoading}><Save size={16} /> Lưu lịch huấn luyện</button>
  </form>;
}

function Metrics({ version }: { version: ModelVersion }) {
  const metrics = version.metrics;
  if (!metrics) return null;
  return <details className="ai-metrics-detail"><summary>Xem đánh giá và câu phân loại sai ({metrics.mistakes.length})</summary>
    <p className="ai-muted">Đánh giá trên {metrics.validationSamples} câu kiểm tra riêng, không đưa vào tập học. Đây là kết quả trên bộ dữ liệu này, chưa phản ánh mọi câu hỏi thực tế.</p>
    <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Intent</th><th>Precision</th><th>Recall</th><th>F1</th><th>Câu kiểm tra</th></tr></thead><tbody>
      {metrics.perIntent.map(item => <tr key={item.intent}><td>{item.intent}</td><td>{percent(item.precision)}</td><td>{percent(item.recall)}</td><td>{percent(item["f1-score"])}</td><td>{item.support}</td></tr>)}
    </tbody></table></div>
    {metrics.mistakes.map((item, i) => <div className="ai-mistake" key={i}><p>“{item.text}”</p><small>Nhãn đúng: <b>{item.actual}</b> · Model đoán: <b>{item.predicted}</b></small></div>)}
    {!metrics.mistakes.length && <p className="ai-muted">Không có câu phân loại sai trong tập kiểm tra này.</p>}
  </details>;
}

export default function AIModelPanel() {
  const query = useTrainingStatus();
  const client = useQueryClient();
  const train = useMutation({ mutationFn: () => api.post("/ai/training/train"), onSuccess: () => { client.invalidateQueries(["ai"]); toast.success("Đã bắt đầu huấn luyện. Kết quả sẽ cập nhật tại đây."); } });
  const activate = useMutation({ mutationFn: (id: string) => api.post(`/ai/training/versions/${id}/activate`), onSuccess: () => { client.invalidateQueries(["ai"]); toast.success("Đã kích hoạt phiên bản model."); } });
  if (query.isLoading || query.isError) return <RequestState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} />;
  const status = query.data!;
  const active = status.versions.find(item => item.id === status.activeVersionId);
  return <div className="ai-stack">
    <div className="ai-model-intro ai-card">
      <div className="ai-section-title"><div><span className="ai-eyebrow">MODEL PHÂN LOẠI Ý ĐỊNH</span><h2>Học từ câu hỏi của khách hàng</h2><p>Model học cách nhận diện câu hỏi và chọn câu trả lời hoặc dữ liệu sản phẩm phù hợp. Mỗi lần huấn luyện tạo một phiên bản để đánh giá và quay lại khi cần.</p></div><Cpu size={36} /></div>
      <div className="ai-stat-grid">
        <div><span>Câu học đã duyệt</span><strong>{status.trainingSamples}</strong></div>
        <div><span>Câu kiểm tra riêng</span><strong>{status.validationSamples}</strong></div>
        <div><span>Câu chờ duyệt</span><strong>{status.pendingSamples}</strong></div>
        <div><span>F1 model đang dùng</span><strong>{percent(active?.metrics?.macroF1)}</strong></div>
      </div>
      <div className="ai-actions"><button className="button" disabled={train.isLoading || !!status.runningJobId} onClick={() => train.mutate()}>{status.runningJobId ? <LoaderCircle className="animate-spin" size={16} /> : <Play size={16} />}{status.runningJobId ? "Đang huấn luyện…" : "Huấn luyện phiên bản mới"}</button><button className="button secondary" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={16} /> Cập nhật</button><span className="ai-muted">{status.pendingChanges} thay đổi chưa huấn luyện</span></div>
      <p className="ai-muted">Mỗi intent đang bật cần ít nhất 3 câu học và 2 câu kiểm tra đã duyệt. Lượt thủ công cần bạn kích hoạt sau khi xem kết quả.</p>
      {!status.activeVersionId && <p className="ai-notice">Chưa kích hoạt model đã học. Trợ lý đang dùng nhận diện cơ bản theo danh mục.</p>}
      {(train.isError || activate.isError || status.artifactError) && <p role="alert" className="ai-error">{status.artifactError || aiError(train.error || activate.error)}</p>}
    </div>
    <section className="ai-card"><div className="ai-section-title"><div><h2>Các phiên bản model</h2><p>Giữ lại kết quả để so sánh. Có thể kích hoạt lại một phiên bản cũ đã đạt ngưỡng.</p></div></div>
      {!status.versions.length && <RequestState empty="Chưa có phiên bản. Bộ câu mẫu ban đầu đã sẵn sàng để huấn luyện." />}
      {status.versions.map(version => <article className="ai-version" key={version.id}>
        <div className="ai-section-title"><div><h3>{version.name} {version.id === status.activeVersionId && <span className="ai-badge"><Check size={13} /> Đang sử dụng</span>}</h3><p>{aiDate(version.createdAt)} · {version.trigger === "automatic" ? "Tự động" : "Thủ công"}</p></div>
          {version.status === "ready" && version.id !== status.activeVersionId && <button className="button secondary" disabled={activate.isLoading || (version.metrics?.macroF1 ?? 0) < status.settings.minF1} onClick={() => activate.mutate(version.id)}>Kích hoạt phiên bản</button>}
        </div>
        {version.status === "running" && <p role="status" className="ai-actions"><LoaderCircle size={16} className="animate-spin" /> Đang học và đánh giá…</p>}
        {version.status === "failed" && <p role="alert" className="ai-error">Huấn luyện thất bại: {version.error}</p>}
        {version.metrics && <p className="ai-version-scores">F1: <b>{percent(version.metrics.macroF1)}</b> <span>Accuracy: <b>{percent(version.metrics.accuracy)}</b></span><span>{version.metrics.trainingSamples} câu học · {version.metrics.validationSamples} câu kiểm tra</span></p>}
        {version.activationNote && <p className="ai-notice">{version.activationNote}</p>}
        {version.metrics && version.metrics.macroF1 < status.settings.minF1 && <p className="ai-error">Chưa đạt ngưỡng F1 {percent(status.settings.minF1)} để kích hoạt.</p>}
        <Metrics version={version} />
      </article>)}
    </section>
    <AutoTrainingForm key={JSON.stringify(status.settings)} initial={status.settings} />
  </div>;
}
