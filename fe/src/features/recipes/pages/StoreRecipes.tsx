import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ClientLayout from "../../../components/layout/client/ClientLayout";
import RequestState from "../../../components/shared/RequestState";
import { urlUtils } from "../../../config/api_cli.config";
import recipeService from "../services/recipeService";

export default function StoreRecipes() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = useQuery({
    queryKey: ["store-recipes", page],
    queryFn: () => recipeService.getRecipes({ page, limit: 9 }),
    enabled: !id,
  });
  const detail = useQuery({
    queryKey: ["store-recipe", id],
    queryFn: () => recipeService.getRecipe(id!),
    enabled: !!id,
  });
  const recipe = detail.data?.recipe;
  const relatedProducts =
    recipe?.relatedProducts?.flatMap((link) =>
      link.product ? [link.product] : []
    ) || [];
  return (
    <ClientLayout>
      <div className="store-container section-space">
        {id ? (
          <>
            <Link className="text-link" to="/shop/recipes">
              <ArrowLeft size={15} />
              Góc vào bếp
            </Link>
            {detail.isLoading || detail.isError || !recipe ? (
              <RequestState
                loading={detail.isLoading}
                error={detail.isError}
                retry={() => detail.refetch()}
              />
            ) : (
              <article className="compact-page">
                <p className="eyebrow">CẢM HỨNG MỖI NGÀY</p>
                <h1 style={{ fontSize: 34, marginBottom: 22 }}>
                  {recipe.title}
                </h1>
                {recipe.coverImage && (
                  <img
                    style={{
                      width: "100%",
                      maxHeight: 430,
                      objectFit: "cover",
                      borderRadius: 4,
                    }}
                    src={urlUtils.getFullImageUrl(recipe.coverImage) || ""}
                    alt={recipe.title}
                  />
                )}
                <div className="detail-block">
                  <p>{recipe.description}</p>
                  <span className="text-link">
                    <Clock size={16} />
                    {(recipe.preparationTime || 0) +
                      (recipe.cookingTime || 0)}{" "}
                    phút · {recipe.servings} phần
                  </span>
                </div>
                <section className="detail-block">
                  <h2>Nguyên liệu</h2>
                  {recipe.ingredients.map((ingredient, i) => (
                    <p key={i}>
                      {ingredient.quantity} {ingredient.unit} {ingredient.name}
                    </p>
                  ))}
                </section>
                <section className="detail-block">
                  <h2>Cùng bắt tay vào bếp</h2>
                  {recipe.instructions.map((step, i) => (
                    <div key={i} style={{ marginBottom: 24 }}>
                      <h3 style={{ fontWeight: 600 }}>Bước {step.step}</h3>
                      <p>{step.description}</p>
                      {step.image && (
                        <img
                          src={urlUtils.getFullImageUrl(step.image) || ""}
                          alt={`Bước ${step.step}`}
                          style={{ maxWidth: 450, width: "100%" }}
                        />
                      )}
                    </div>
                  ))}
                </section>
                {relatedProducts.length > 0 && (
                  <section className="detail-block">
                    <h2>Dụng cụ cho món ăn này</h2>
                    <div className="recipe-grid">
                      {relatedProducts.map((product) => (
                        <Link
                          className="recipe-item"
                          to={`/shop/product/${product._id}`}
                          key={product._id}
                        >
                          <img
                            loading="lazy"
                            style={{ objectFit: "contain" }}
                            src={
                              urlUtils.getFullImageUrl(
                                product.images?.[0]?.url
                              ) || "/images/product-placeholder.svg"
                            }
                            alt={product.name}
                          />
                          <h3>{product.name}</h3>
                          {typeof product.basePrice === "number" && (
                            <p>{product.basePrice.toLocaleString("vi-VN")} ₫</p>
                          )}
                          <span className="text-link">
                            Xem sản phẩm <ArrowUpRight size={15} />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </article>
            )}
          </>
        ) : (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">MỘT CHÚT CẢM HỨNG</p>
                <h1>Góc vào bếp</h1>
              </div>
            </div>
            {query.isLoading || query.isError || !query.data?.recipes.length ? (
              <RequestState
                loading={query.isLoading}
                error={query.isError}
                retry={() => query.refetch()}
                empty="Các công thức mới đang được cập nhật."
              />
            ) : (
              <>
                <div className="recipe-grid">
                  {query.data.recipes.map((r) => (
                    <Link
                      className="recipe-item"
                      to={`/shop/recipes/${r._id}`}
                      key={r._id}
                    >
                      <img
                        src={
                          urlUtils.getFullImageUrl(r.coverImage) ||
                          "/images/kitchen.jpg"
                        }
                        alt={r.title}
                        loading="lazy"
                      />
                      <h2>{r.title}</h2>
                      <p className="line-clamp-2">{r.description}</p>
                      <span className="text-link" style={{ marginTop: 15 }}>
                        Vào bếp <ArrowUpRight size={15} />
                      </span>
                    </Link>
                  ))}
                </div>
                {query.data.pagination.totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="icon-button"
                      disabled={page <= 1}
                      onClick={() => setParams({ page: String(page - 1) })}
                      aria-label="Trang trước"
                    >
                      <ChevronLeft />
                    </button>
                    <span>
                      {page} / {query.data.pagination.totalPages}
                    </span>
                    <button
                      className="icon-button"
                      disabled={page >= query.data.pagination.totalPages}
                      onClick={() => setParams({ page: String(page + 1) })}
                      aria-label="Trang sau"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ClientLayout>
  );
}
