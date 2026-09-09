// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../config/api_cli.config", () => ({ api: http }));
import VoucherManagement from "../features/vouchers/pages/dashboard/Vouchers";

const clients: QueryClient[] = [];
const response = {
  data: { data: {
    vouchers: [{ _id: "v1", code: "KITCHEN10", description: "Giảm 10%", discountType: "percentage", discountValue: 10, minOrderValue: 100000, maxUsage: 0, currentUsage: 0, startDate: "2026-01-01", endDate: "2099-12-31", isActive: true }],
    pagination: { currentPage: 1, totalPages: 1, totalItems: 1, limit: 10 },
  } },
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, cacheTime: 0 } },
    logger: { log: console.log, warn: console.warn, error: vi.fn() },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}><VoucherManagement /></QueryClientProvider>);
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

it("shows a retriable error instead of an empty list when the API fails", async () => {
  http.get.mockRejectedValueOnce(new Error("Server unavailable")).mockResolvedValue(response);
  renderPage();
  expect((await screen.findByRole("alert")).textContent).toContain("Không thể tải dữ liệu");
  expect(screen.queryByText("Không có mã giảm giá nào")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("KITCHEN10")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(http.get).toHaveBeenCalledTimes(2);
});

it("sends search, status and discount filters and clears them back to page one", async () => {
  http.get.mockResolvedValue(response);
  renderPage();
  await screen.findByText("KITCHEN10");
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm mã giảm giá" }), { target: { value: "KITCHEN" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Trạng thái mã giảm giá" }), { target: { value: "inactive" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Loại mã giảm giá" }), { target: { value: "fixed" } });
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith("/vouchers?page=1&limit=10&search=KITCHEN&isActive=false&discountType=fixed"));
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith("/vouchers?page=1&limit=10"));
});
