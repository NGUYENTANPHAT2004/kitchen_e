// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../config/api_cli.config", () => ({
  api: http,
  urlUtils: { getFullImageUrl: (url: string) => url },
}));
import { cartService } from "../features/cart/service/cart-service";
import orderService, {
  normalizeOrder,
} from "../features/order/services/order-service";
import flashSaleService from "../features/flash-sales/services/flashSaleService";
import authService from "../features/auth/services/auth-service";
beforeEach(() => vi.resetAllMocks());
describe("Commerce API contracts", () => {
  it("normalizes the login id for authenticated cart ownership", async () => {
    authService.clearAuthData();
    const token = `header.${btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
    )}.signature`;
    http.post.mockResolvedValue({
      data: {
        token,
        user: {
          id: "u1",
          email: "test@kitchen.local",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    });
    const response = await authService.login({
      email: "test@kitchen.local",
      password: "test",
    });
    expect(response.user).toMatchObject({ _id: "u1", name: "Test Customer" });
    expect(authService.getCachedUser()?._id).toBe("u1");
    authService.clearAuthData();
  });
  it("loads the complete cart after a mutation returning only one cartItem", async () => {
    http.post.mockResolvedValue({
      data: { data: { cartItem: { _id: "ci1" }, totalItems: 2 } },
    });
    http.get.mockResolvedValue({
      data: {
        data: {
          cart: {
            items: [
              {
                _id: "ci1",
                productId: { _id: "p1", name: "Pan", basePrice: 100 },
                price: 100,
                quantity: 2,
              },
            ],
          },
        },
      },
    });
    const items = await cartService.addToCart("p1", undefined, 2);
    expect(http.get).toHaveBeenCalledWith("/cart");
    expect(items[0]).toMatchObject({
      cartItemId: "ci1",
      productId: "p1",
      quantity: 2,
    });
  });
  it("normalizes orderItems and isPaid", () => {
    expect(
      normalizeOrder({ orderItems: [{ _id: "i1" }], isPaid: true })
    ).toMatchObject({ items: [{ _id: "i1" }], paymentStatus: "paid" });
    expect(
      normalizeOrder({ status: "refunded", isPaid: true }).paymentStatus
    ).toBe("refunded");
  });
  it("always requests admin scope explicitly", async () => {
    http.get.mockResolvedValue({ data: { data: { orders: [] } } });
    await orderService.getOrders({ page: 1, limit: 10 });
    expect(http.get).toHaveBeenCalledWith("/orders", {
      params: { page: 1, limit: 10, scope: "admin" },
    });
  });
  it("normalizes bare Flash Sale detail responses", async () => {
    http.get.mockResolvedValue({ data: { data: { _id: "sale1", items: [] } } });
    expect((await flashSaleService.getFlashSale("sale1")).flashSale._id).toBe(
      "sale1"
    );
  });
});
