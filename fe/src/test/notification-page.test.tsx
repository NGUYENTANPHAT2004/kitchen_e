// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../config/api_cli.config", () => ({
  api: http,
  endpoints: { notifications: { base: "/notifications", byId: (id: string) => `/notifications/${id}`, read: (id: string) => `/notifications/${id}/read` } },
}));
import NotificationManagement from "../features/notifications/page/NotificationManagement";
import type { AppNotification } from "../features/notifications/interface/interface";

const notice: AppNotification = { _id: "notice-1", title: "Cập nhật đơn hàng", message: "Thông báo kiểm thử", type: "order_status", priority: "medium", isRead: false, createdAt: "2026-09-08T00:00:00Z" };
const response = (rows: AppNotification[] = [notice]) => ({ data: { data: { notifications: rows, pagination: { total: rows.length, totalPages: 1, currentPage: 1, perPage: 10 } } } });
const clients: QueryClient[] = [];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } }, logger: { log: console.log, warn: console.warn, error: vi.fn() } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><NotificationManagement /></QueryClientProvider>);
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

it("offers retry on load failure and recovers without an incorrect empty state", async () => {
  http.get.mockRejectedValueOnce(new Error("Server unavailable")).mockResolvedValue(response());
  renderPage();
  expect((await screen.findByRole("alert")).textContent).toContain("Không thể tải dữ liệu");
  expect(screen.queryByText("Không có thông báo nào.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText(notice.title)).toBeTruthy();
  expect(http.get).toHaveBeenCalledTimes(2);
});

it("searches through the server instead of only filtering the currently loaded page", async () => {
  const olderNotice = { ...notice, _id: "notice-older", title: "Ưu đãi tuần trước" };
  http.get.mockImplementation((url: string) => Promise.resolve(response(url.includes("search=") ? [olderNotice] : [notice])));
  renderPage();
  await screen.findByText(notice.title);
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm thông báo" }), { target: { value: "tuần trước" } });
  expect(await screen.findByText(olderNotice.title)).toBeTruthy();
  const query = new URLSearchParams({ page: "1", limit: "10", search: "tuần trước" });
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith(`/notifications?${query}`));
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith("/notifications?page=1&limit=10"));
});

it("updates the detail dialog after the read request succeeds", async () => {
  http.get.mockResolvedValue(response());
  http.put.mockResolvedValue({ data: { data: { ...notice, isRead: true } } });
  renderPage();
  await screen.findByText(notice.title);
  fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
  const dialog = await screen.findByRole("dialog", { name: /Chi tiết thông báo/ });
  expect(await within(dialog).findByText("Đã đọc")).toBeTruthy();
  expect(http.put).toHaveBeenCalledWith("/notifications/notice-1/read");
});
