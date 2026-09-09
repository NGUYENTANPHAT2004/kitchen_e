import ClientLayout from "../../components/layout/client/ClientLayout";
import RequestState from "../../components/shared/RequestState";
import StoreProductCard from "../products/components/StoreProductCard";
import { useWishlist } from "./useWishlist";

export default function WishlistPage() {
  const { items, isLoading, isError, refetch } = useWishlist();
  return (
    <ClientLayout>
      <div className="store-container section-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BỘ SƯU TẬP CỦA BẠN</p>
            <h1>Sản phẩm yêu thích</h1>
          </div>
          <span>{items.length} sản phẩm</span>
        </div>
        {isLoading || isError || !items.length ? (
          <RequestState
            loading={isLoading}
            error={isError}
            retry={() => refetch()}
            empty="Bạn chưa lưu sản phẩm nào."
          />
        ) : (
          <div className="product-grid">
            {items.map((item) => (
              <StoreProductCard key={item._id} product={item.productId} />
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
