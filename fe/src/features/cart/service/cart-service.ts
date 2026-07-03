import { api } from '../../../config/api_cli.config';
import type { CartItem } from '../context/cart-context';

interface BackendCartItem {
  _id: string;
  productId: { _id: string; name: string; images?: { url: string }[]; basePrice: number };
  variantId?: { _id: string; price?: number; attributes?: { name: string; value: string }[] };
  quantity: number;
  price: number;
  customizations?: Record<string, { value: string; priceAdjustment: number }>;
}

interface BackendCart {
  _id: string;
  items: BackendCartItem[];
  totalPrice?: number;
}

function mapItem(item: BackendCartItem): CartItem {
  const product = item.productId;
  const variant = item.variantId;
  const customizationLabel = item.customizations
    ? Object.entries(item.customizations).map(([k, v]) => `${k}: ${v.value}`).join(', ')
    : '';
  const variantLabel = variant?.attributes?.map((a) => `${a.name}: ${a.value}`).join(', ') ?? '';
  const customizationKey = item.customizations
    ? Object.entries(item.customizations).map(([k, v]) => `${k}:${v.value}`).join('|')
    : '';
  return {
    id: [product._id, variant?._id, customizationKey].filter(Boolean).join('-'),
    productId: product._id,
    variantId: variant?._id,
    name: product.name,
    price: item.price ?? variant?.price ?? product.basePrice ?? 0,
    image: product.images?.[0]?.url ?? '',
    variant: [variantLabel, customizationLabel].filter(Boolean).join(' | '),
    customizations: item.customizations,
    quantity: item.quantity,
    cartItemId: item._id,
  };
}

async function getCart(): Promise<CartItem[]> {
  const res = await api.get('/cart');
  const cart: BackendCart = res.data.data?.cart ?? res.data.cart ?? res.data.data ?? res.data;
  return (cart?.items ?? []).map(mapItem);
}

async function addToCart(
  productId: string,
  variantId: string | undefined,
  quantity: number,
  customizations?: Record<string, { value: string; priceAdjustment: number }>
): Promise<CartItem[]> {
  const res = await api.post('/cart/items', { productId, variantId, quantity, customizations });
  const cart: BackendCart = res.data.data?.cart ?? res.data.cart ?? res.data.data ?? res.data;
  return (cart?.items ?? []).map(mapItem);
}

async function updateCartItem(cartItemId: string, quantity: number): Promise<CartItem[]> {
  const res = await api.put(`/cart/items/${cartItemId}`, { quantity });
  const cart: BackendCart = res.data.data?.cart ?? res.data.cart ?? res.data.data ?? res.data;
  return (cart?.items ?? []).map(mapItem);
}

async function removeCartItem(cartItemId: string): Promise<CartItem[]> {
  const res = await api.delete(`/cart/items/${cartItemId}`);
  const cart: BackendCart = res.data.data?.cart ?? res.data.cart ?? res.data.data ?? res.data;
  return (cart?.items ?? []).map(mapItem);
}

async function clearCart(): Promise<void> {
  await api.delete('/cart');
}

async function mergeCart(localItems: CartItem[]): Promise<CartItem[]> {
  const items = localItems.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
  }));
  const res = await api.post('/cart/merge', { items });
  const cart: BackendCart = res.data.data?.cart ?? res.data.cart ?? res.data.data ?? res.data;
  return (cart?.items ?? []).map(mapItem);
}

export const cartService = { getCart, addToCart, updateCartItem, removeCartItem, clearCart, mergeCart };
