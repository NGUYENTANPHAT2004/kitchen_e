import { Heart, Plus, ArrowUpRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../cart/context/cart-hook";
import { useWishlist } from "../../wishlist/useWishlist";
import { urlUtils } from "../../../config/api_cli.config";
import type { Product } from "../services/productService";

export default function StoreProductCard({ product }: { product: Product }) {
  const { addItem, isSyncing } = useCart();
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const image =
    urlUtils.getFullImageUrl(
      product.images?.find((i) => i.isDefault)?.url || product.images?.[0]?.url
    ) || urlUtils.getFallbackImageUrl();
  const saved = wishlist.items.some(
    (item) => item.productId?._id === product._id
  );
  const chooseOptions =
    product.isCustomizable ||
    product.variants === undefined ||
    Boolean(product.variants.length);
  return (
    <article className="store-product">
      <div className="product-photo">
        <Link to={`/shop/product/${product._id}`}>
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = urlUtils.getFallbackImageUrl();
            }}
          />
        </Link>
        {product.featured && (
          <span className="product-tag">ĐƯỢC YÊU THÍCH</span>
        )}
        <button
          className={`icon-button wish-button ${saved ? "saved" : ""}`}
          title={saved ? "Bỏ yêu thích" : "Yêu thích"}
          aria-label={saved ? "Bỏ yêu thích" : "Yêu thích"}
          aria-pressed={saved}
          disabled={wishlist.busy}
          onClick={() => wishlist.toggle(product._id)}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-meta">
        <span>{product.categoryId?.name || "Kitchen E"}</span>
        <span>{product.stockQuantity > 0 ? "Còn hàng" : "Hết hàng"}</span>
      </div>
      <Link className="product-title" to={`/shop/product/${product._id}`}>
        {product.name}
      </Link>
      <div className="product-bottom">
        <strong>{product.basePrice.toLocaleString("vi-VN")} ₫</strong>
        <button
          className="product-add"
          title={chooseOptions ? "Chọn phiên bản" : "Thêm vào giỏ"}
          aria-label={`${chooseOptions ? "Chọn" : "Thêm"} ${product.name}`}
          disabled={isSyncing || product.stockQuantity <= 0}
          onClick={() =>
            chooseOptions
              ? navigate(`/shop/product/${product._id}`)
              : addItem({
                  id: product._id,
                  productId: product._id,
                  name: product.name,
                  price: product.basePrice,
                  image,
                  variant: "",
                })
          }
        >
          {chooseOptions ? <ArrowUpRight size={19} /> : <Plus size={19} />}
        </button>
      </div>
    </article>
  );
}
