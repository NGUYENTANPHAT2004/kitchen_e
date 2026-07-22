import { createContext } from 'react';

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

export interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);
