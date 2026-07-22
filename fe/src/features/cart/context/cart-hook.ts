import { useContext } from 'react';
import { CartContext } from './cart-context-value';
import type { CartContextValue } from './cart-context-value';

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
