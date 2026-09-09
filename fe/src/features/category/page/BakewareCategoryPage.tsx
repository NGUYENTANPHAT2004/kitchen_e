import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";
import { productService } from "../../products/services/productService";
import type { Product } from "../../products/services/productService";
import { categoryService } from "../service/categoryService";
import ClientLayout from "../../../components/layout/client/ClientLayout";
import StoreProductCard from "../../products/components/StoreProductCard";
import RequestState from "../../../components/shared/RequestState";

export default function BakewareCategoryPage() {
  const { categoryId = "all" } = useParams();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = params.get("search") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sort = params.get("sort") || "-createdAt";
  const inStock = params.get("inStock") === "true";
  const maxPrice = Number(params.get("maxPrice")) || undefined;
  const categories = useQuery({
    queryKey: ["categories-client"],
    queryFn: () => categoryService.getCategories(),
  });
  const current = categories.data?.find(
    (c) => c._id === categoryId || c.slug === categoryId
  );
  const products = useQuery({
    queryKey: [
      "store-products",
      categoryId,
      search,
      page,
      sort,
      inStock,
      maxPrice,
    ],
    queryFn: () =>
      productService.getProducts({
        category: categoryId !== "all" ? categoryId : undefined,
        search,
        page,
        sort,
        inStock,
        maxPrice,
        limit: 12,
      }),
    keepPreviousData: true,
  });
  const rows: Product[] = products.data?.data?.products || [];
  const pagination = products.data?.data?.pagination;
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  return (
    <ClientLayout>
      <div className="store-container section-space catalog">
        <div className="breadcrumbs">
          <Link to="/shop/home">Trang chủ</Link>
          <ChevronRight size={14} />
          <span>{current?.name || "Tất cả sản phẩm"}</span>
        </div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">BỘ SƯU TẬP KITCHEN E</p>
            <h1>
              {search
                ? `Kết quả cho “${search}”`
                : current?.name || "Tất cả sản phẩm"}
            </h1>
            <p className="muted">
              {current?.description ||
                "Những lựa chọn thiết thực cho căn bếp mỗi ngày."}
            </p>
          </div>
        </div>
        <div className="catalog-layout">
          <aside className={`catalog-filters ${filtersOpen ? "is-open" : ""}`}>
            <h3>Danh mục</h3>
            <Link
              className={categoryId === "all" ? "selected" : ""}
              to="/shop/category/all"
            >
              Tất cả sản phẩm
            </Link>
            {categories.data
              ?.filter((c) => c.isActive)
              .map((c) => (
                <Link
                  className={current?._id === c._id ? "selected" : ""}
                  key={c._id}
                  to={`/shop/category/${c._id}`}
                >
                  {c.name}
                </Link>
              ))}
            <hr />
            <h3>Mức giá</h3>
            <select
              aria-label="Mức giá"
              value={maxPrice || ""}
              onChange={(e) => update("maxPrice", e.target.value)}
            >
              <option value="">Tất cả mức giá</option>
              <option value="200000">Dưới 200.000 ₫</option>
              <option value="500000">Dưới 500.000 ₫</option>
              <option value="1000000">Dưới 1.000.000 ₫</option>
            </select>
            <label className="check-label">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) =>
                  update("inStock", e.target.checked ? "true" : "")
                }
              />
              Chỉ sản phẩm còn hàng
            </label>
            {(maxPrice || inStock || search) && (
              <button className="text-link" onClick={() => setParams({})}>
                <X size={14} />
                Xóa bộ lọc
              </button>
            )}
          </aside>
          <div className="catalog-results">
            <div className="catalog-toolbar">
              <button
                className="button secondary filter-toggle"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={16} />
                Bộ lọc
              </button>
              <span className="muted">
                {pagination?.totalItems || 0} sản phẩm
              </span>
              <select
                aria-label="Sắp xếp sản phẩm"
                value={sort}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="-createdAt">Mới nhất</option>
                <option value="basePrice">Giá tăng dần</option>
                <option value="-basePrice">Giá giảm dần</option>
                <option value="name">Tên A - Z</option>
              </select>
            </div>
            <form
              className="catalog-search"
              onSubmit={(e) => {
                e.preventDefault();
                update(
                  "search",
                  String(new FormData(e.currentTarget).get("search") || "")
                );
              }}
            >
              <Search size={17} />
              <input
                key={search}
                name="search"
                aria-label="Tìm trong bộ sưu tập"
                defaultValue={search}
                placeholder="Tìm tên sản phẩm..."
              />
              <button className="text-link">Tìm kiếm</button>
            </form>
            {products.isLoading || products.isError || !rows.length ? (
              <RequestState
                loading={products.isLoading}
                error={products.isError}
                retry={() => products.refetch()}
                empty="Không tìm thấy sản phẩm phù hợp."
              />
            ) : (
              <div className="product-grid catalog-product-grid">
                {rows.map((product) => (
                  <StoreProductCard key={product._id} product={product} />
                ))}
              </div>
            )}
            {pagination?.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="icon-button"
                  disabled={page <= 1 || products.isFetching}
                  aria-label="Trang trước"
                  onClick={() => update("page", String(page - 1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  Trang {page} / {pagination.totalPages}
                </span>
                <button
                  className="icon-button"
                  disabled={
                    page >= pagination.totalPages || products.isFetching
                  }
                  aria-label="Trang sau"
                  onClick={() => update("page", String(page + 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
