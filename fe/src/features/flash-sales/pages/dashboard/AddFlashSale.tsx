import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import flashSaleService from "../../services/flashSaleService";
import type { FlashSaleItemFormData } from "../../interface/interface";
import { productService } from "../../../products/services/productService";
import type { Product } from "../../../products/services/productService";
import RequestState from "../../../../components/shared/RequestState";

type Item = FlashSaleItemFormData & { key: string; name: string };
const localDate = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function AddFlashSale() {
  const { id = "" } = useParams();
  const savedId = useRef(id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [priority, setPriority] = useState(0);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["flash-sales", id],
    enabled: !!id,
    queryFn: () => flashSaleService.getFlashSale(id),
  });
  const products = useQuery({
    queryKey: ["flash-sale-products", search],
    queryFn: () => productService.getProducts({ search, limit: 50 }),
  });
  const catalog: Product[] = products.data?.data?.products || [];
  const selected = catalog.find((product) => product._id === productId);
  useEffect(() => {
    const sale = query.data?.flashSale;
    if (!sale) return;
    setName(sale.name);
    setDescription(sale.description || "");
    setStartDate(localDate(sale.startDate));
    setEndDate(localDate(sale.endDate));
    setBannerImage(sale.bannerImage || "");
    setPriority(sale.priority || 0);
    setItems(
      (sale.items || []).map((item) => {
        const variant = item.variantId as string | { _id: string } | undefined;
        return {
          key: item._id,
          name: item.productId?.name || "Sản phẩm đã xóa",
          productId: item.productId?._id || "",
          variantId: typeof variant === "object" ? variant._id : variant,
          discountPercent: item.discountPercent,
          quantity: item.quantity,
          maxPerCustomer: item.maxPerCustomer || 0,
        };
      })
    );
  }, [query.data]);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        bannerImage,
        priority,
      };
      if (!savedId.current)
        savedId.current = (
          await flashSaleService.createFlashSale(payload)
        ).flashSale._id;
      else await flashSaleService.updateFlashSale(savedId.current, payload);
      // Re-read before syncing: retrying a partial save must not duplicate sale items.
      const current =
        (await flashSaleService.getFlashSale(savedId.current)).flashSale
          .items || [];
      const variantKey = (value: unknown) =>
        typeof value === "object" && value
          ? (value as { _id: string })._id
          : value || "";
      for (const item of items) {
        const existing = current.find(
          (entry) =>
            entry.productId?._id === item.productId &&
            variantKey(entry.variantId) === (item.variantId || "")
        );
        const data = {
          productId: item.productId,
          variantId: item.variantId || undefined,
          discountPercent: item.discountPercent,
          quantity: item.quantity,
          maxPerCustomer: item.maxPerCustomer || 0,
        };
        if (existing) await flashSaleService.updateItem(existing._id, data);
        else await flashSaleService.addItem(savedId.current, data);
      }
      for (const entry of current) {
        if (
          !items.some(
            (item) =>
              item.productId === entry.productId?._id &&
              (item.variantId || "") === variantKey(entry.variantId)
          )
        )
          await flashSaleService.removeItem(entry._id);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["flash-sales"] });
      toast.success("Đã lưu chương trình.");
      navigate("/marketing/flash-sales");
    },
    onError: (error: any) =>
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error?.message ||
          "Chưa lưu xong. Vui lòng thử lại."
      ),
  });

  if (id && (query.isLoading || query.isError))
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
        if (
          !name.trim() ||
          !items.length ||
          new Date(endDate) <= new Date(startDate)
        ) {
          toast.error("Kiểm tra tên, thời gian và danh sách sản phẩm.");
          return;
        }
        save.mutate();
      }}
    >
      <Link className="text-link" to="/marketing/flash-sales">
        <ArrowLeft size={16} />
        Chương trình ưu đãi
      </Link>
      <div className="section-heading" style={{ marginTop: 24 }}>
        <h1>{id ? "Chỉnh sửa Flash Sale" : "Tạo Flash Sale"}</h1>
        <button className="button" disabled={save.isLoading}>
          <Save size={16} />
          Lưu chương trình
        </button>
      </div>
      <div className="form-grid">
        <label className="field full">
          Tên chương trình
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Bắt đầu
          <input
            type="datetime-local"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="field">
          Kết thúc
          <input
            type="datetime-local"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className="field full">
          Mô tả
          <textarea
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          URL ảnh bìa
          <input
            value={bannerImage}
            onChange={(e) => setBannerImage(e.target.value)}
          />
        </label>
        <label className="field">
          Thứ tự ưu tiên
          <input
            type="number"
            min={0}
            max={100}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>
      </div>
      <section className="form-section">
        <h2>Sản phẩm trong chương trình</h2>
        <div className="form-grid">
          <label className="field full">
            Tìm sản phẩm
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setProductId("");
              }}
            />
          </label>
          <label className="field">
            Sản phẩm
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId("");
              }}
            >
              <option value="">Chọn sản phẩm</option>
              {catalog.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Phiên bản
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              <option value="">Sản phẩm gốc</option>
              {selected?.variants?.map((variant) => (
                <option key={variant._id} value={variant._id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {products.isError && (
          <RequestState error retry={() => products.refetch()} />
        )}
        <button
          type="button"
          className="button secondary"
          style={{ marginBlock: 20 }}
          disabled={!selected || save.isLoading}
          onClick={() => {
            if (!selected) return;
            if (
              items.some(
                (item) =>
                  item.productId === productId &&
                  (item.variantId || "") === variantId
              )
            ) {
              toast.error("Sản phẩm đã có trong chương trình.");
              return;
            }
            setItems((previous) => [
              ...previous,
              {
                key: crypto.randomUUID(),
                name: `${selected.name}${
                  variantId
                    ? ` (${
                        selected.variants?.find((v) => v._id === variantId)
                          ?.name
                      })`
                    : ""
                }`,
                productId,
                variantId,
                discountPercent: 10,
                quantity: 1,
                maxPerCustomer: 0,
              },
            ]);
          }}
        >
          <Plus size={16} />
          Thêm sản phẩm
        </button>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Giảm (%)</th>
                <th>Số lượng</th>
                <th>Tối đa / khách</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td>{item.name}</td>
                  {(
                    ["discountPercent", "quantity", "maxPerCustomer"] as const
                  ).map((field) => (
                    <td key={field}>
                      <input
                        style={{ width: 85 }}
                        aria-label={`${item.name} ${field}`}
                        type="number"
                        required
                        min={field === "maxPerCustomer" ? 0 : 1}
                        max={field === "discountPercent" ? 100 : 99999}
                        value={item[field]}
                        onChange={(e) =>
                          setItems((previous) =>
                            previous.map((entry) =>
                              entry.key === item.key
                                ? { ...entry, [field]: Number(e.target.value) }
                                : entry
                            )
                          )
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Xóa ${item.name}`}
                      onClick={() =>
                        setItems((previous) =>
                          previous.filter((entry) => entry.key !== item.key)
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}
