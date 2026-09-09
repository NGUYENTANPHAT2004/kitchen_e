// @vitest-environment happy-dom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../features/cart/context/cart-context";
import { useCart } from "../features/cart/context/cart-hook";
import type { CartItem } from "../features/cart/context/cart-context-value";

const mocks = vi.hoisted(() => ({
  auth: {
    state: {
      isAuthenticated: false,
      loading: false,
      user: null as null | { _id: string },
    },
  },
  service: {
    getCart: vi.fn(),
    mergeCart: vi.fn(),
    addToCart: vi.fn(),
    updateCartItem: vi.fn(),
    removeCartItem: vi.fn(),
    clearCart: vi.fn(),
  },
}));
vi.mock("../features/auth/hooks/auth-hook", () => ({
  useAuth: () => mocks.auth,
}));
vi.mock("../features/cart/service/cart-service", () => ({
  cartService: mocks.service,
}));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const item: CartItem = {
  id: "p1",
  productId: "p1",
  name: "Pan",
  image: "",
  variant: "",
  price: 100,
  quantity: 1,
};
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  mocks.auth.state = { isAuthenticated: false, loading: false, user: null };
});
afterEach(cleanup);
describe("Cart account lifecycle", () => {
  it("persists guest additions and restores after remount", async () => {
    const first = renderHook(useCart, { wrapper: CartProvider });
    act(() => first.result.current.addItem(item));
    expect(
      JSON.parse(localStorage.getItem("kitchen_cart")!).items
    ).toHaveLength(1);
    first.unmount();
    const second = renderHook(useCart, { wrapper: CartProvider });
    expect(second.result.current.totalItems).toBe(1);
  });
  it("merges guest cart once on login and never leaks account items on logout", async () => {
    localStorage.setItem("kitchen_cart", JSON.stringify({ items: [item] }));
    mocks.service.mergeCart.mockResolvedValue([
      { ...item, quantity: 3, cartItemId: "server1" },
    ]);
    const hook = renderHook(useCart, { wrapper: CartProvider });
    mocks.auth.state = {
      isAuthenticated: true,
      loading: false,
      user: { _id: "u1" },
    };
    hook.rerender();
    await waitFor(() => expect(hook.result.current.totalItems).toBe(3));
    hook.rerender();
    expect(mocks.service.mergeCart).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("kitchen_cart")).toBeNull();
    mocks.auth.state = { isAuthenticated: false, loading: false, user: null };
    hook.rerender();
    await waitFor(() => expect(hook.result.current.totalItems).toBe(0));
    expect(localStorage.getItem("kitchen_cart")).toBeNull();
  });
  it("ignores a delayed previous-account response after logout", async () => {
    let resolve!: (items: CartItem[]) => void;
    mocks.service.getCart.mockReturnValue(
      new Promise<CartItem[]>((done) => {
        resolve = done;
      })
    );
    mocks.auth.state = {
      isAuthenticated: true,
      loading: false,
      user: { _id: "u1" },
    };
    const hook = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(mocks.service.getCart).toHaveBeenCalledOnce());
    mocks.auth.state = { isAuthenticated: false, loading: false, user: null };
    hook.rerender();
    await act(async () => resolve([item]));
    expect(hook.result.current.items).toEqual([]);
  });
  it("preserves cart and exposes a retryable error when synchronization fails", async () => {
    mocks.service.getCart
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([item]);
    mocks.auth.state = {
      isAuthenticated: true,
      loading: false,
      user: { _id: "u1" },
    };
    const hook = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(hook.result.current.syncError).toBeTruthy());
    await act(() => hook.result.current.refreshCart());
    expect(hook.result.current.syncError).toBeNull();
    expect(hook.result.current.totalItems).toBe(1);
  });
});
