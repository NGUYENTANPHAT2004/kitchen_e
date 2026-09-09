import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../config/api_cli.config";
import { useAuth } from "../auth/hooks/auth-hook";
import type { Product } from "../products/services/productService";

export interface WishlistItem {
  _id: string;
  productId: Product;
  variantId?: { _id: string; name: string; priceAdjustment: number };
}
export function useWishlist() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const query = useQuery<WishlistItem[]>({
    queryKey: ["wishlist", state.user?._id],
    enabled: state.isAuthenticated,
    queryFn: async () =>
      (await api.get("/wishlist", { params: { limit: 100 } })).data.data
        .wishlistItems,
  });
  const mutation = useMutation({
    mutationFn: (productId: string) =>
      api.post("/wishlist/toggle", { productId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["wishlist"] }),
    onError: () => toast.error("Không thể cập nhật danh sách yêu thích."),
  });
  const toggle = (productId: string) => {
    if (!state.isAuthenticated) {
      navigate(`/auth/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    mutation.mutate(productId);
  };
  return {
    ...query,
    items: query.data || [],
    toggle,
    busy: mutation.isLoading,
  };
}
