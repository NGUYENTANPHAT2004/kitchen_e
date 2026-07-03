import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { cartService } from '../service/cart-service';

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  cartItemId?: string;
  name: string;
  price: number;
  image: string;
  variant: string;
  customizations?: Record<string, { value: string; priceAdjustment: number }>;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'SET_ITEMS'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> & { quantity?: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' };

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = 'kitchen_cart';

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.payload };
    case 'ADD_ITEM': {
      const existing = state.items.find((item) => item.id === action.payload.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + (action.payload.quantity ?? 1) }
              : item
          ),
        };
      }
      return {
        items: [...state.items, { ...action.payload, quantity: action.payload.quantity ?? 1 }],
      };
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter((item) => item.id !== action.payload) };
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return { items: state.items.filter((item) => item.id !== action.payload.id) };
      }
      return {
        items: state.items.map((item) =>
          item.id === action.payload.id ? { ...item, quantity: action.payload.quantity } : item
        ),
      };
    }
    case 'CLEAR_CART':
      return { items: [] };
    default:
      return state;
  }
}

function loadCartFromStorage(): CartState {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : { items: [] };
  } catch {
    return { items: [] };
  }
}

function isLoggedIn(): boolean {
  const token = localStorage.getItem('token');
  return !!token && token !== 'undefined' && token !== 'null';
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCartFromStorage);
  const pendingOps = useRef<Promise<void>>(Promise.resolve());

  // On mount: if logged in, sync cart from server (merge guest cart if any)
  useEffect(() => {
    if (!isLoggedIn()) return;

    const localItems = state.items;
    pendingOps.current = pendingOps.current.then(async () => {
      try {
        let items: CartItem[];
        if (localItems.length > 0) {
          items = await cartService.mergeCart(localItems);
          localStorage.removeItem(CART_STORAGE_KEY);
        } else {
          items = await cartService.getCart();
        }
        dispatch({ type: 'SET_ITEMS', payload: items });
      } catch {
        // network failure — keep local cart
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage for guest users
  useEffect(() => {
    if (!isLoggedIn()) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
    }
  }, [state.items]);

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    dispatch({ type: 'ADD_ITEM', payload: item });

    if (!isLoggedIn()) return;

    pendingOps.current = pendingOps.current.then(async () => {
      try {
        const items = await cartService.addToCart(
          item.productId,
          item.variantId,
          item.quantity ?? 1,
          item.customizations
        );
        dispatch({ type: 'SET_ITEMS', payload: items });
      } catch {
        // optimistic update already applied
      }
    });
  };

  const removeItem = (id: string) => {
    const target = state.items.find((i) => i.id === id);
    dispatch({ type: 'REMOVE_ITEM', payload: id });

    if (!isLoggedIn() || !target?.cartItemId) return;

    pendingOps.current = pendingOps.current.then(async () => {
      try {
        const items = await cartService.removeCartItem(target.cartItemId!);
        dispatch({ type: 'SET_ITEMS', payload: items });
      } catch {
        // optimistic remove already applied
      }
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    const target = state.items.find((i) => i.id === id);

    if (quantity <= 0) {
      removeItem(id);
      return;
    }

    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });

    if (!isLoggedIn() || !target?.cartItemId) return;

    pendingOps.current = pendingOps.current.then(async () => {
      try {
        const items = await cartService.updateCartItem(target.cartItemId!, quantity);
        dispatch({ type: 'SET_ITEMS', payload: items });
      } catch {
        // optimistic update already applied
      }
    });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });

    if (!isLoggedIn()) return;

    pendingOps.current = pendingOps.current.then(async () => {
      try {
        await cartService.clearCart();
      } catch {
        // fire and forget
      }
    });
  };

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        totalItems,
        subtotal,
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

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
