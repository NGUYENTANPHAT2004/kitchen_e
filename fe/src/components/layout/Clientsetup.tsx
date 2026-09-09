import {
  ArrowRight,
  ArrowUpRight,
  Truck,
  PackageCheck,
  Headphones,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productService } from "../../features/products/services/productService";
import type { Product } from "../../features/products/services/productService";
import { categoryService } from "../../features/category/service/categoryService";
import StoreProductCard from "../../features/products/components/StoreProductCard";
import {
  defaultSettings,
  useStoreSettings,
} from "../../features/store/useStoreSettings";
import RequestState from "../shared/RequestState";
import ClientLayout from "./client/ClientLayout";
import { urlUtils } from "../../config/api_cli.config";

export default function Clientsetup() {
  const products = useQuery({
    queryKey: ["store-featured"],
    queryFn: () => productService.getFeaturedProducts(8),
  });
  const categories = useQuery({
    queryKey: ["categories-client"],
    queryFn: () => categoryService.getCategories(),
  });
  const { data: settings = defaultSettings } = useStoreSettings();
  const featured: Product[] = products.data?.data?.products || [];
  return (
    <ClientLayout>
      <section className="store-hero">
        <img
          src="/images/kitchen.jpg"
          alt="Gian bếp sáng với nồi inox và dụng cụ nấu ăn"
          fetchPriority="high"
        />
        <div className="store-container hero-inner">
          <p className="eyebrow">CHỌN TỪNG MÓN. YÊU TỪNG BỮA.</p>
          <h1>
            Dụng cụ bếp
            <br />
            Kitchen E<span>.</span>
          </h1>
          <p>
            Thêm cảm hứng cho bữa cơm nhà.
            <br />
            Từ những món đồ bạn dùng mỗi ngày.
          </p>
          <Link className="button" to="/shop/category/all">
            Khám phá bộ sưu tập <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="hero-caption">CĂN BẾP NHỎ, NIỀM VUI LỚN</div>
      </section>
      <section className="service-strip">
        <div className="store-container">
          <div>
            <Truck size={24} strokeWidth={1.4} />
            <span>
              <strong>Giao hàng tận nhà</strong>
              <small>
                Miễn phí từ{" "}
                {settings.freeShippingThreshold.toLocaleString("vi-VN")} ₫
              </small>
            </span>
          </div>
          <div>
            <PackageCheck size={24} strokeWidth={1.4} />
            <span>
              <strong>Mua sắm an tâm</strong>
              <small>Thông tin sản phẩm rõ ràng</small>
            </span>
          </div>
          <Link to="/shop/support">
            <Headphones size={24} strokeWidth={1.4} />
            <span>
              <strong>Luôn sẵn sàng hỗ trợ</strong>
              <small>Đồng hành cùng căn bếp của bạn</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <section className="store-container section-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MỖI GÓC BẾP, MỘT LỰA CHỌN</p>
            <h2>Bạn đang tìm gì?</h2>
          </div>
          <Link className="text-link" to="/shop/category/all">
            Tất cả sản phẩm <ArrowRight size={17} />
          </Link>
        </div>
        {categories.isError ? (
          <RequestState error retry={() => categories.refetch()} />
        ) : (
          <div className="category-grid">
            {(categories.data || [])
              .filter((c) => c.isActive && !c.isDeleted)
              .slice(0, 4)
              .map((category, i) => (
                <Link
                  className={`category-tile category-${i}`}
                  key={category._id}
                  to={`/shop/category/${category._id}`}
                >
                  <img
                    loading="lazy"
                    src={
                      urlUtils.getFullImageUrl(category.image) ||
                      urlUtils.getFallbackImageUrl()
                    }
                    alt={category.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = urlUtils.getFallbackImageUrl();
                    }}
                  />
                  <div>
                    <span>{category.name}</span>
                    <ArrowUpRight size={20} />
                  </div>
                </Link>
              ))}
          </div>
        )}
      </section>
      <section className="product-section">
        <div className="store-container section-space">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NHỮNG MÓN ĐỒ ĐÁNG CÓ</p>
              <h2>Chọn cho căn bếp của bạn</h2>
            </div>
            <Link className="text-link" to="/shop/category/all">
              Xem bộ sưu tập <ArrowRight size={17} />
            </Link>
          </div>
          {products.isLoading || products.isError || !featured.length ? (
            <RequestState
              loading={products.isLoading}
              error={products.isError}
              retry={() => products.refetch()}
              empty="Bộ sưu tập đang được cập nhật."
            />
          ) : (
            <div className="product-grid">
              {featured.map((product) => (
                <StoreProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="store-container editorial-band">
        <div>
          <p className="eyebrow">NIỀM VUI BẮT ĐẦU TỪ CĂN BẾP</p>
          <h2>Hôm nay, mình nấu gì?</h2>
          <p>Một chút cảm hứng cho bữa ăn sắp tới.</p>
        </div>
        <Link className="button secondary" to="/shop/recipes">
          Ghé góc vào bếp <ArrowUpRight size={18} />
        </Link>
      </section>
    </ClientLayout>
  );
}
