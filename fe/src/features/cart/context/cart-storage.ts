import type { CartItem } from './cart-context-value';

export interface CartStorageState {
  items: CartItem[];
}

function normalizeCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== 'object') return null;

  const item = value as Partial<CartItem>;
  if (
    typeof item.id !== 'string' ||
    item.id.length === 0 ||
    typeof item.productId !== 'string' ||
    item.productId.length === 0 ||
    typeof item.name !== 'string' ||
    typeof item.price !== 'number' ||
    !Number.isFinite(item.price) ||
    typeof item.quantity !== 'number' ||
    !Number.isFinite(item.quantity) ||
    item.quantity <= 0
  ) {
    return null;
  }

  return {
    ...item,
    image: typeof item.image === 'string' ? item.image : '',
    variant: typeof item.variant === 'string' ? item.variant : '',
    quantity: Math.floor(item.quantity),
  } as CartItem;
}

export function normalizeStoredCart(value: unknown): CartStorageState {
  const storedItems = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as CartStorageState).items)
      ? (value as CartStorageState).items
      : [];

  return {
    items: storedItems
      .map(normalizeCartItem)
      .filter((item): item is CartItem => item !== null),
  };
}

export function loadCartFromStorage(initialState: CartStorageState): CartStorageState {
  if (typeof localStorage === 'undefined') return initialState;

  try {
    const stored = localStorage.getItem('kitchen_cart');
    return stored ? normalizeStoredCart(JSON.parse(stored)) : initialState;
  } catch {
    return initialState;
  }
}
