import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Heart,
  Minus,
  Plus,
  Star,
  Truck,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, urlUtils } from "../../../../config/api_cli.config";
import { productService } from "../../services/productService";
import type { Product } from "../../services/productService";
import type { Variant } from "../../../variants/interfaces/interface";
import type { Customization } from "../../../customizations/interface/interface";
import { customizationService } from "../../../customizations/service/customizationService";
import { useCart } from "../../../cart/context/cart-hook";
import { useAuth } from "../../../auth/hooks/auth-hook";
import { useWishlist } from "../../../wishlist/useWishlist";
import {
  defaultSettings,
  useStoreSettings,
} from "../../../store/useStoreSettings";
import ClientLayout from "../../../../components/layout/client/ClientLayout";
import RequestState from "../../../../components/shared/RequestState";
import StoreProductCard from "../../components/StoreProductCard";

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  userId?: { firstName?: string; lastName?: string; username?: string };
  isVerifiedPurchase: boolean;
}

function ProductContent({ productId }: { productId: string }) {
  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productService.getProduct(productId),
  });
  const variantsQuery = useQuery<Variant[]>({
    queryKey: ["variants-store", productId],
    queryFn: async () =>
      (await api.get(`/products/${productId}/variants`)).data.data.variants ||
      [],
  });
  const customizationsQuery = useQuery<Customization[]>({
    queryKey: ["customizations-store", productId],
    queryFn: () => customizationService.getProductCustomizations(productId),
  });
  const reviews = useQuery<Review[]>({
    queryKey: ["product-reviews", productId],
    queryFn: async () =>
      (await api.get(`/products/${productId}/reviews`)).data.data.reviews || [],
  });
  const related = useQuery({
    queryKey: ["store-related"],
    queryFn: () => productService.getFeaturedProducts(4),
  });
  const { data: settings = defaultSettings } = useStoreSettings();
  const { addItem, isSyncing } = useCart();
  const { state } = useAuth();
  const wishlist = useWishlist();
  const client = useQueryClient();
  const [variantId, setVariantId] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const reviewMutation = useMutation({
    mutationFn: () => api.post("/reviews", { productId, rating, comment }),
    onSuccess: () => {
      setComment("");
      client.invalidateQueries({ queryKey: ["product-reviews", productId] });
      toast.success("Đã gửi đánh giá để duyệt.");
    },
    onError: (e: any) =>
      toast.error(
        e.response?.data?.message ||
          e.response?.data?.error?.message ||
          "Không thể gửi đánh giá."
      ),
  });
  const product: Product | undefined = productQuery.data?.data?.product;
  if (productQuery.isLoading || productQuery.isError || !product)
    return (
      <RequestState
        loading={productQuery.isLoading}
        error={productQuery.isError}
        retry={() => productQuery.refetch()}
        empty="Sản phẩm không còn tồn tại."
      />
    );
  const variants = (variantsQuery.data || []).filter(
    (v) => v.isActive !== false && !v.isDeleted
  );
  const variant = variants.find((v) => v._id === variantId) || variants[0];
  const customizations: Customization[] = (
    customizationsQuery.data || []
  ).filter((c) => c.isActive && !c.isDeleted);
  const chosen = customizations.map((c) => ({
    definition: c,
    option:
      c.options.find((o) => o.value === selected[c._id]) ||
      (selected[c._id] === ""
        ? undefined
        : c.options.find((o) => o.isDefault) ||
          (c.isRequired ? c.options[0] : undefined)),
  }));
  const price =
    product.basePrice +
    (variant?.priceAdjustment || 0) +
    chosen.reduce((sum, c) => sum + (c.option?.priceAdjustment || 0), 0);
  const stock = variant ? variant.stockQuantity : product.stockQuantity;
  const images = variant?.images?.length ? variant.images : product.images;
  const image =
    urlUtils.getFullImageUrl(images?.[imageIndex]?.url || images?.[0]?.url) ||
    urlUtils.getFallbackImageUrl();
  const saved = wishlist.items.some(
    (item) => item.productId?._id === productId
  );
  const blocked =
    isSyncing ||
    variantsQuery.isLoading ||
    variantsQuery.isError ||
    customizationsQuery.isLoading ||
    customizationsQuery.isError ||
    quantity > stock ||
    chosen.some((c) => c.definition.isRequired && !c.option);
  const add = () => {
    const values = Object.fromEntries(
      chosen
        .filter((c) => c.option)
        .map((c) => [
          c.definition.name,
          {
            value: c.option!.value,
            priceAdjustment: c.option!.priceAdjustment,
          },
        ])
    );
    addItem({
      id: [
        productId,
        variant?._id,
        ...Object.entries(values).map(([k, v]) => `${k}:${v.value}`),
      ]
        .filter(Boolean)
        .join("-"),
      productId,
      variantId: variant?._id,
      name: product.name,
      image,
      price,
      quantity,
      customizations: values,
      variant: [
        variant?.name,
        ...chosen.filter((c) => c.option).map((c) => c.option?.name),
      ]
        .filter(Boolean)
        .join(" · "),
    });
  };
  return (
    <div className="store-container section-space product-detail">
      <div className="breadcrumbs">
        <Link to="/shop/home">Trang chủ</Link>
        <ChevronRight size={14} />
        <Link to={`/shop/category/${product.categoryId?._id || "all"}`}>
          {product.categoryId?.name || "Sản phẩm"}
        </Link>
        <ChevronRight size={14} />
        <span>{product.name}</span>
      </div>
      <div className="product-detail-grid">
        <div>
          <div className="detail-photo">
            <img
              src={image}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = urlUtils.getFallbackImageUrl();
              }}
            />
          </div>
          {images?.length > 1 && (
            <div className="thumbnail-row">
              {images.map((entry, i) => (
                <button
                  key={i}
                  aria-label={`Ảnh ${i + 1}`}
                  aria-pressed={i === imageIndex}
                  onClick={() => setImageIndex(i)}
                >
                  <img src={urlUtils.getFullImageUrl(entry.url) || ""} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-information">
          <p className="eyebrow">{product.categoryId?.name || "KITCHEN E"}</p>
          <h1>{product.name}</h1>
          <a href="#reviews" className="text-link">
            <Star size={14} />
            {reviews.data?.length
              ? `${reviews.data.length} đánh giá`
              : "Chưa có đánh giá"}
          </a>
          <div className="detail-price">{price.toLocaleString("vi-VN")} ₫</div>
          <p className="detail-description">{product.description}</p>
          <div className="detail-stock">
            <span className={stock ? "in-stock-dot" : ""} />
            {stock ? `Còn ${stock} sản phẩm` : "Tạm hết hàng"}
            <span>SKU: {variant?.sku || product.sku}</span>
          </div>
          {variants.length > 0 && (
            <label className="field">
              Phiên bản
              <select
                value={variant?._id || ""}
                onChange={(e) => {
                  setVariantId(e.target.value);
                  setImageIndex(0);
                  setQuantity(1);
                }}
              >
                {variants.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                    {v.stockQuantity <= 0 ? " (Hết hàng)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {customizations.map((c) => (
            <label className="field" key={c._id} style={{ marginTop: 15 }}>
              {c.name}
              {c.isRequired ? " *" : ""}
              <select
                value={
                  chosen.find((choice) => choice.definition._id === c._id)
                    ?.option?.value || ""
                }
                onChange={(e) =>
                  setSelected((previous) => ({
                    ...previous,
                    [c._id]: e.target.value,
                  }))
                }
              >
                {!c.isRequired && <option value="">Không chọn</option>}
                {c.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.name || option.value}
                    {option.priceAdjustment
                      ? ` (+${option.priceAdjustment.toLocaleString(
                          "vi-VN"
                        )} ₫)`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {(variantsQuery.isError || customizationsQuery.isError) && (
            <div className="error-banner">
              Không tải được tùy chọn sản phẩm.
              <button
                onClick={() => {
                  variantsQuery.refetch();
                  customizationsQuery.refetch();
                }}
              >
                Thử lại
              </button>
            </div>
          )}
          <div className="detail-purchase">
            <div className="quantity-stepper">
              <button
                disabled={quantity <= 1}
                aria-label="Giảm số lượng"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={16} />
              </button>
              <span>{quantity}</span>
              <button
                disabled={quantity >= stock}
                aria-label="Tăng số lượng"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="button"
              disabled={blocked || !stock}
              onClick={add}
            >
              {!stock ? "Tạm hết hàng" : "Thêm vào giỏ"}
              <ArrowRight size={16} />
            </button>
            <button
              className="icon-button"
              title="Yêu thích"
              aria-label="Yêu thích sản phẩm"
              aria-pressed={saved}
              disabled={wishlist.busy}
              onClick={() => wishlist.toggle(productId)}
            >
              <Heart size={21} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="detail-delivery">
            <Truck size={21} strokeWidth={1.4} />
            <span>
              Miễn phí giao hàng từ{" "}
              {settings.freeShippingThreshold.toLocaleString("vi-VN")} ₫
            </span>
          </div>
        </div>
      </div>
      <section id="reviews" className="section-space">
        <div className="section-heading">
          <h2>Đánh giá từ khách hàng</h2>
        </div>
        <div className="support-grid">
          <div>
            {reviews.isLoading || reviews.isError || !reviews.data?.length ? (
              <RequestState
                loading={reviews.isLoading}
                error={reviews.isError}
                retry={() => reviews.refetch()}
                empty="Chưa có đánh giá. Hãy chia sẻ trải nghiệm của bạn."
              />
            ) : (
              reviews.data.map((review) => (
                <article className="detail-block" key={review._id}>
                  <strong>
                    {[review.userId?.firstName, review.userId?.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                      review.userId?.username ||
                      "Khách hàng"}
                  </strong>
                  <div
                    className="review-stars"
                    aria-label={`${review.rating} trên 5 sao`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        size={13}
                        key={i}
                        fill={i < review.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                  <p>{review.comment}</p>
                  {review.isVerifiedPurchase && (
                    <small className="success-text">Đã mua hàng</small>
                  )}
                </article>
              ))
            )}
          </div>
          <div>
            {state.isAuthenticated ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  reviewMutation.mutate();
                }}
              >
                <h3 style={{ fontSize: 18 }}>Trải nghiệm của bạn</h3>
                <div
                  className="review-stars"
                  role="group"
                  aria-label="Chọn số sao"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <button
                      type="button"
                      key={i}
                      className="icon-button"
                      aria-label={`${i + 1} sao`}
                      aria-pressed={rating === i + 1}
                      onClick={() => setRating(i + 1)}
                    >
                      <Star
                        size={21}
                        fill={i < rating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
                <label className="field">
                  Nhận xét
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button
                  className="button"
                  style={{ marginTop: 16 }}
                  disabled={reviewMutation.isLoading}
                >
                  Gửi đánh giá
                  <ArrowRight size={15} />
                </button>
              </form>
            ) : (
              <Link
                className="button secondary"
                to={`/auth/login?redirect=${encodeURIComponent(
                  `/shop/product/${productId}`
                )}`}
              >
                Đăng nhập để đánh giá
              </Link>
            )}
          </div>
        </div>
      </section>
      {(related.data?.data?.products || []).length > 1 && (
        <section className="section-space">
          <div className="section-heading">
            <h2>Có thể bạn cũng thích</h2>
          </div>
          <div className="product-grid">
            {(related.data.data.products as Product[])
              .filter((p) => p._id !== productId)
              .map((p) => (
                <StoreProductCard key={p._id} product={p} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
export default function ProductDetail() {
  const { id = "" } = useParams();
  return (
    <ClientLayout>
      <ProductContent key={id} productId={id} />
    </ClientLayout>
  );
}
