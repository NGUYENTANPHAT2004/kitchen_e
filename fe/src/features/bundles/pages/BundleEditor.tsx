import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../../config/api_cli.config";
import { productService } from "../../products/services/productService";
import type { Product } from "../../products/services/productService";
import bundleService from "../services/bundleService";
import RequestState from "../../../components/shared/RequestState";

export default function BundleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    discountType: "percentage",
    discountValue: 10,
    isActive: false,
  });
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const detail = useQuery({
    queryKey: ["bundle-editor", id],
    queryFn: () => bundleService.getBundle(id!),
    enabled: !!id,
  });
  const products = useQuery({
    queryKey: ["bundle-product-options"],
    queryFn: () => productService.getProducts({ limit: 100 }),
  });
  useEffect(() => {
    if (detail.data?.bundle) {
      const b = detail.data.bundle;
      setForm({
        name: b.name,
        description: b.description,
        discountType: b.discountType,
        discountValue: b.discountValue,
        isActive: b.isActive,
      });
    }
  }, [detail.data]);
  const mutation = useMutation({
    mutationFn: async () => {
      const response = id
        ? await api.put(`/bundles/${id}`, form)
        : await api.post("/bundles", form);
      return response.data.data.bundle;
    },
    onSuccess: (bundle) => {
      client.invalidateQueries({ queryKey: ["bundles"] });
      client.invalidateQueries({ queryKey: ["bundle-editor"] });
      toast.success("Đã lưu combo");
      if (!id)
        navigate(`/marketing/bundles/${bundle._id}/edit`, { replace: true });
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Không thể lưu combo"),
  });
  const itemMutation = useMutation({
    mutationFn: (removeId?: string) =>
      removeId
        ? api.delete(`/bundles/${id}/items/${removeId}`)
        : api.post(`/bundles/${id}/items`, { productId, quantity }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bundle-editor"] });
      setProductId("");
      toast.success("Đã cập nhật sản phẩm");
    },
    onError: () => toast.error("Không thể cập nhật sản phẩm combo"),
  });
  if (id && (detail.isLoading || detail.isError))
    return (
      <RequestState
        loading={detail.isLoading}
        error={detail.isError}
        retry={() => detail.refetch()}
      />
    );
  return (
    <div className="admin-form">
      <Link className="text-link" to="/marketing/bundles">
        <ArrowLeft size={15} />
        Danh sách combo
      </Link>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="section-heading" style={{ marginTop: 24 }}>
          <h1>{id ? "Chỉnh sửa combo" : "Tạo combo"}</h1>
          <button className="button" disabled={mutation.isLoading}>
            <Save size={16} />
            Lưu combo
          </button>
        </div>
        <div className="form-grid">
          <label className="field full">
            Tên combo
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field full">
            Mô tả
            <textarea
              required
              maxLength={1000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="field">
            Loại ưu đãi
            <select
              value={form.discountType}
              onChange={(e) =>
                setForm({ ...form, discountType: e.target.value })
              }
            >
              <option value="percentage">Phần trăm</option>
              <option value="fixed">Số tiền</option>
            </select>
          </label>
          <label className="field">
            Giá trị ưu đãi
            <input
              type="number"
              required
              min={0}
              max={form.discountType === "percentage" ? 100 : 100000000}
              value={form.discountValue}
              onChange={(e) =>
                setForm({ ...form, discountValue: Number(e.target.value) })
              }
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Kích hoạt
          </label>
        </div>
      </form>
      {id && (
        <section className="form-section">
          <h2>Sản phẩm trong combo</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Số lượng</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {detail.data?.bundle.items?.map((item) => (
                  <tr key={item._id}>
                    <td>
                      {typeof item.productId === "object"
                        ? item.productId?.name
                        : item.productId}
                    </td>
                    <td>{item.quantity}</td>
                    <td>
                      <button
                        className="icon-button"
                        title="Xóa sản phẩm"
                        disabled={itemMutation.isLoading}
                        onClick={() => {
                          if (confirm("Xóa sản phẩm khỏi combo?"))
                            itemMutation.mutate(item._id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="report-toolbar"
            style={{ marginTop: 24 }}
            onSubmit={(e) => {
              e.preventDefault();
              itemMutation.mutate(undefined);
            }}
          >
            <label className="field">
              Sản phẩm
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Chọn sản phẩm</option>
                {(products.data?.data?.products || []).map((p: Product) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Số lượng
              <input
                type="number"
                required
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <button
              className="button"
              disabled={itemMutation.isLoading || products.isError}
            >
              <Plus size={16} />
              Thêm sản phẩm
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
