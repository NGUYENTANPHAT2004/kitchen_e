import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../config/api_cli.config";
import {
  useStoreSettings,
  defaultSettings,
} from "../../features/store/useStoreSettings";
import type { StoreSettings } from "../../features/store/useStoreSettings";
import RequestState from "../../components/shared/RequestState";
import { useAuth } from "../../features/auth/hooks/auth-hook";

export default function SystemSettings() {
  const query = useStoreSettings();
  const { state } = useAuth();
  const [form, setForm] = useState<StoreSettings>(defaultSettings);
  const [dirty, setDirty] = useState(false);
  const client = useQueryClient();
  useEffect(() => {
    if (query.data) {
      setForm(
        Object.fromEntries(
          Object.keys(defaultSettings).map((key) => [
            key,
            query.data[key as keyof StoreSettings],
          ])
        ) as unknown as StoreSettings
      );
      setDirty(false);
    }
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: () => api.put("/settings", form),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["store-settings"] });
      setDirty(false);
      toast.success("Đã lưu cài đặt cửa hàng.");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Không thể lưu cài đặt."),
  });
  const field = (name: keyof StoreSettings, label: string, type = "text") => (
    <label className="field" key={name}>
      {label}
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={form[name]}
        maxLength={name === "address" ? 300 : 100}
        required={type === "number" || name === "storeName"}
        onChange={(e) => {
          setDirty(true);
          setForm((previous) => ({
            ...previous,
            [name]: type === "number" ? Number(e.target.value) : e.target.value,
          }));
        }}
      />
    </label>
  );
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
        mutation.mutate();
      }}
    >
      <div className="section-heading">
        <h1>Cài đặt cửa hàng</h1>
        <button
          className="button"
          disabled={
            !dirty || mutation.isLoading || state.user?.role !== "admin"
          }
        >
          <Save size={16} />
          {mutation.isLoading ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
      <section className="form-section">
        <h2>Thông tin cửa hàng</h2>
        <div className="form-grid">
          {field("storeName", "Tên cửa hàng")}
          {field("contactEmail", "Email hỗ trợ", "email")}
          {field("contactPhone", "Điện thoại", "tel")}
          {field("address", "Địa chỉ")}
        </div>
      </section>
      <section className="form-section">
        <h2>Giao hàng</h2>
        <div className="form-grid">
          {field("standardShipping", "Phí giao tiêu chuẩn (₫)", "number")}
          {field("expressShipping", "Phí giao nhanh (₫)", "number")}
          {field("freeShippingThreshold", "Miễn phí với đơn từ (₫)", "number")}
        </div>
      </section>
      <section className="form-section">
        <h2>Tài khoản nhận chuyển khoản</h2>
        <div className="form-grid">
          {field("bankName", "Ngân hàng")}
          {field("bankAccount", "Số tài khoản")}
          {field("bankAccountName", "Tên chủ tài khoản")}
        </div>
      </section>
    </form>
  );
}
