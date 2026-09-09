import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../../../config/api_cli.config";
import RequestState from "../../../../components/shared/RequestState";

export default function AISettingsPanel() {
  const client = useQueryClient();
  const [form, setForm] = useState({ enabled: false, language: "vi" });
  const query = useQuery<{ settings: typeof form; connected: boolean }>({
    queryKey: ["ai-settings"],
    queryFn: async () => (await api.get("/ai/settings")).data.data,
  });
  useEffect(() => {
    if (query.data) setForm(query.data.settings);
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => api.put("/ai/settings", form),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ai-settings"] });
      client.invalidateQueries({ queryKey: ["ai", "public-status"] });
      toast.success("Đã lưu cấu hình trợ lý.");
    },
    onError: () => toast.error("Không thể lưu cấu hình."),
  });
  if (query.isLoading || query.isError)
    return (
      <RequestState
        loading={query.isLoading}
        error={query.isError}
        retry={() => query.refetch()}
      />
    );
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="section-heading">
        <h2>Cấu hình trợ lý</h2>
        <button className="button" disabled={save.isLoading}>
          <Save size={16} />
          Lưu cấu hình
        </button>
      </div>
      <div className="detail-block">
        <span
          className={`status-badge ${
            query.data?.connected ? "" : "status-cancelled"
          }`}
        >
          {query.data?.connected
            ? "Dịch vụ AI đã kết nối"
            : "Dịch vụ AI chưa kết nối"}
        </span>
        <button
          type="button"
          className="icon-button"
          title="Kiểm tra kết nối"
          aria-label="Kiểm tra kết nối"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="form-grid" style={{ marginTop: 24 }}>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Bật trợ lý trò chuyện
        </label>
        <label className="field">
          Ngôn ngữ mặc định
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </form>
  );
}
