import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/hooks/auth-hook";
import { cartService } from "../service/cart-service";
import { CartContext } from "./cart-context-value";
import type { CartItem } from "./cart-context-value";
import { loadCartFromStorage } from "./cart-storage";

const STORAGE_KEY = "kitchen_cart";

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { state: auth } = useAuth();
  const userId = auth.isAuthenticated ? auth.user?._id : undefined;
  const [items, setItems] = useState<CartItem[]>(
    () => loadCartFromStorage().items
  );
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const previousUser = useRef<string | null | undefined>(null);
  const epoch = useRef(0);
  const currentItems = useRef(items);
  currentItems.current = items;

  const enqueue = useCallback(
    (operation: () => Promise<CartItem[]>, success?: string) => {
      const version = epoch.current;
      setPending((count) => count + 1);
      queue.current = queue.current
        .then(async () => {
          if (version !== epoch.current) return;
          try {
            const result = await operation();
            if (version !== epoch.current) return;
            currentItems.current = result;
            setItems(result);
            setSyncError(null);
            if (success) toast.success(success);
          } catch {
            if (version !== epoch.current) return;
            setSyncError("Không thể đồng bộ giỏ hàng. Vui lòng thử lại.");
            toast.error("Không thể cập nhật giỏ hàng.");
          }
        })
        .finally(() => setPending((count) => Math.max(0, count - 1)));
      return queue.current;
    },
    []
  );

  useEffect(() => {
    if (auth.loading || previousUser.current === userId) return;
    previousUser.current = userId;
    epoch.current += 1;
    setSyncError(null);
    if (!userId) {
      setItems(loadCartFromStorage().items);
      return;
    }
    const guest = loadCartFromStorage().items;
    setItems([]);
    void enqueue(async () => {
      const result = guest.length
        ? await cartService.mergeCart(guest)
        : await cartService.getCart();
      localStorage.removeItem(STORAGE_KEY);
      return result;
    });
  }, [auth.loading, userId, enqueue]);

  const updateGuest = (update: (previous: CartItem[]) => CartItem[]) => {
    const next = update(currentItems.current);
    currentItems.current = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: next }));
    } catch {
      /* Cart remains usable without storage. */
    }
    setItems(next);
  };

  const refreshCart = useCallback(async () => {
    await queue.current;
    if (userId) await enqueue(cartService.getCart);
  }, [enqueue, userId]);

  const addItem = (
    item: Omit<CartItem, "quantity"> & { quantity?: number }
  ) => {
    const quantity = Math.max(1, Math.min(999, Math.floor(item.quantity || 1)));
    if (userId) {
      void enqueue(
        () =>
          cartService.addToCart(
            item.productId,
            item.variantId,
            quantity,
            item.customizations
          ),
        "Đã thêm vào giỏ hàng"
      );
      return;
    }
    updateGuest((previous) => {
      const existing = previous.find((entry) => entry.id === item.id);
      return existing
        ? previous.map((entry) =>
            entry.id === item.id
              ? { ...entry, quantity: Math.min(999, entry.quantity + quantity) }
              : entry
          )
        : [...previous, { ...item, quantity }];
    });
    toast.success("Đã thêm vào giỏ hàng");
  };

  const removeItem = (id: string) => {
    if (!userId) {
      updateGuest((previous) => previous.filter((item) => item.id !== id));
      return;
    }
    void enqueue(async () => {
      const target = currentItems.current.find((item) => item.id === id);
      return target?.cartItemId
        ? cartService.removeCartItem(target.cartItemId)
        : cartService.getCart();
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity > 999) return;
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    if (!userId) {
      updateGuest((previous) =>
        previous.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
      return;
    }
    void enqueue(async () => {
      const target = currentItems.current.find((item) => item.id === id);
      return target?.cartItemId
        ? cartService.updateCartItem(target.cartItemId, quantity)
        : cartService.getCart();
    });
  };

  const clearCart = () => {
    if (!userId) {
      updateGuest(() => []);
      return;
    }
    void enqueue(async () => {
      await cartService.clearCart();
      return [];
    });
  };

  return (
    <CartContext.Provider
      value={{
        items,
        isSyncing: pending > 0 || auth.loading,
        syncError,
        refreshCart,
        totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
