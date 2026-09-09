// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../config/api_cli.config', async (importOriginal) => ({
  ...await importOriginal<typeof import('../config/api_cli.config')>(),
  api: http,
}));
import ReviewManagement from '../features/reviews/pages/ReviewManagement';
import type { ReviewPayload } from '../features/reviews/interface/interface';

const review: ReviewPayload = {
  _id: 'review-1',
  userId: { _id: 'user-1', username: 'kitchen_customer', firstName: 'Minh', lastName: 'Anh' },
  productId: { _id: 'product-1', name: 'Nồi gang tráng men' },
  rating: 5, title: 'Sản phẩm tốt', comment: 'Giữ nhiệt rất tốt', images: [], likes: 0,
  isApproved: true, isRejected: false, isDeleted: false, reportCount: 0, isVerifiedPurchase: true,
  createdAt: '2026-09-08T00:00:00Z', updatedAt: '2026-09-08T00:00:00Z',
};

const response = (rows: ReviewPayload[] = [review], page = 1, total = rows.length) => ({
  data: { data: { reviews: rows, pagination: { currentPage: page, totalPages: Math.max(1, Math.ceil(total / 20)), totalDocs: total, limit: 20 } } },
});
const clients: QueryClient[] = [];
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, cacheTime: 0 } },
    logger: { log: console.log, warn: console.warn, error: vi.fn() },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}><ReviewManagement /></QueryClientProvider>);
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('renders the actual API name, image objects and response date in the table and detail dialog', async () => {
  http.get.mockResolvedValue(response([{
    ...review,
    images: [{ url: '/uploads/reviews/photo.jpg', caption: 'Sản phẩm' }, 'https://example.test/legacy.jpg', null],
    adminResponse: { comment: 'Cảm ơn bạn đã tin tưởng', createdAt: '2026-09-07T01:00:00Z' },
  }]));
  renderPage();
  expect(await screen.findByText('Minh Anh')).toBeTruthy();
  expect(screen.getByText('2 ảnh')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết đánh giá' }));
  const dialog = await screen.findByRole('dialog', { name: 'Chi tiết đánh giá' });
  expect(within(dialog).getByText('Minh Anh')).toBeTruthy();
  expect(within(dialog).getByRole('img', { name: 'Ảnh đánh giá 1' }).getAttribute('src')).toContain('/uploads/reviews/photo.jpg');
  expect(within(dialog).getByRole('img', { name: 'Ảnh đánh giá 2' }).getAttribute('src')).toBe('https://example.test/legacy.jpg');
  expect(within(dialog).getByText(/Phản hồi cũ/).textContent).toContain('07/09/2026');
  expect(dialog.textContent).not.toContain('Invalid Date');
});

it.each([
  { userId: { _id: 'user-1', username: 'kitchen_customer' }, productId: null, name: 'kitchen_customer' },
  { userId: null, productId: null, name: 'Khách hàng' },
  { userId: 'removed-user', productId: 'removed-product', name: 'Khách hàng' },
])('keeps a review usable when a relation has no name: $name', async ({ userId, productId, name }) => {
  http.get.mockResolvedValue(response([{ ...review, userId, productId, adminResponse: {} }]));
  renderPage();
  expect(await screen.findByText(name)).toBeTruthy();
  expect(screen.getByText('Sản phẩm không còn khả dụng')).toBeTruthy();
  expect(screen.queryByText('Đã phản hồi')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết đánh giá' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(name)).toBeTruthy();
  expect(within(dialog).getByText('Sản phẩm không còn khả dụng')).toBeTruthy();
});

it('shows a retriable load error and only fetches the active tab', async () => {
  http.get.mockRejectedValueOnce(new Error('Server unavailable')).mockResolvedValue(response());
  renderPage();
  expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải dữ liệu');
  expect(screen.queryByText('Không có đánh giá nào')).toBeNull();
  expect(http.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Minh Anh')).toBeTruthy();
  expect(http.get).toHaveBeenCalledTimes(2);
});

it('loads API-shaped pending and reported records when switching tabs', async () => {
  http.get.mockImplementation((url: string) => Promise.resolve(response([{
    ...review,
    title: url.includes('pending') ? 'Đang chờ xét duyệt' : url.includes('reported') ? 'Cần kiểm tra báo cáo' : review.title,
    isApproved: !url.includes('pending'), reportCount: url.includes('reported') ? 2 : 0,
  }])));
  renderPage();
  await screen.findByText(review.title!);
  fireEvent.click(screen.getByRole('button', { name: 'Chờ duyệt' }));
  expect(await screen.findByText('Đang chờ xét duyệt')).toBeTruthy();
  expect(http.get).toHaveBeenLastCalledWith('/reviews/admin/pending?page=1&limit=20');
  fireEvent.click(screen.getByRole('button', { name: 'Báo cáo' }));
  expect(await screen.findByText('Cần kiểm tra báo cáo')).toBeTruthy();
  expect(http.get).toHaveBeenLastCalledWith('/reviews/admin/reported?page=1&limit=20');
});

it('resets pagination and selection when search or rating changes', async () => {
  http.get.mockImplementation((url: string) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
    return Promise.resolve(response([review], page, 21));
  });
  renderPage();
  await screen.findByText('Minh Anh');
  expect(screen.getByText('21')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/reviews?page=2&limit=20&sort=-createdAt'));
  await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Chọn tất cả đánh giá trên trang' }) as HTMLInputElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả đánh giá trên trang' }));
  expect(screen.getByText('1 đã chọn')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm đánh giá' }), { target: { value: 'nồi' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Số sao đánh giá' }), { target: { value: '5' } });
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/reviews?page=1&limit=20&rating=5&search=n%E1%BB%93i&sort=-createdAt'));
  expect(screen.queryByText('1 đã chọn')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/reviews?page=1&limit=20&sort=-createdAt'));
});

it('sends approval and a response in one request, then refreshes the visible status', async () => {
  let row = { ...review, isApproved: false };
  http.get.mockImplementation(() => Promise.resolve(response([row])));
  http.post.mockImplementation(async () => {
    row = { ...row, isApproved: true, adminResponse: { comment: 'Cảm ơn bạn', createdAt: '2026-09-08T00:00:00Z' } };
    return { data: { data: row } };
  });
  renderPage();
  await screen.findByText('Minh Anh');
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết đánh giá' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Phản hồi của cửa hàng' }), { target: { value: '  Cảm ơn bạn  ' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt & phản hồi' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(http.post).toHaveBeenCalledWith('/reviews/review-1/respond', { comment: 'Cảm ơn bạn', approve: true });
  expect(http.put).not.toHaveBeenCalled();
  expect(await screen.findByText('Đã duyệt')).toBeTruthy();
  expect(screen.getByText('Đã phản hồi')).toBeTruthy();
});

it('preserves the rejection reason on failure and closes only after a successful retry', async () => {
  http.get.mockResolvedValue(response([{ ...review, isApproved: false }]));
  http.put.mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue({ data: { data: { ...review, isApproved: false, isRejected: true } } });
  renderPage();
  await screen.findByText('Minh Anh');
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết đánh giá' }));
  const dialog = await screen.findByRole('dialog');
  const reason = within(dialog).getByRole('textbox', { name: 'Lý do từ chối (nếu từ chối)' });
  fireEvent.change(reason, { target: { value: 'Nội dung không phù hợp' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Không thể lưu thay đổi');
  expect((reason as HTMLInputElement).value).toBe('Nội dung không phù hợp');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(http.put).toHaveBeenLastCalledWith('/reviews/review-1/reject', { reason: 'Nội dung không phù hợp' });
});

it('keeps only failed rows selected after partial bulk approval', async () => {
  const second = { ...review, _id: 'review-2', userId: { _id: 'user-2', username: 'second_customer' }, isApproved: false };
  let first = { ...review, isApproved: false };
  http.get.mockImplementation(() => Promise.resolve(response([first, second])));
  http.put.mockImplementation(async (url: string) => {
    if (url.includes('review-2')) throw new Error('Save failed');
    first = { ...first, isApproved: true };
    return { data: { data: first } };
  });
  renderPage();
  await screen.findByText('Minh Anh');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả đánh giá trên trang' }));
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Không thể xử lý 1 đánh giá');
  expect((screen.getByRole('checkbox', { name: 'Chọn đánh giá của second_customer' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('checkbox', { name: 'Chọn đánh giá của Minh Anh' }) as HTMLInputElement).checked).toBe(false);
});

it('returns to an existing page after deleting the last item on the final page', async () => {
  let deleted = false;
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  http.get.mockImplementation((url: string) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
    return Promise.resolve(response(deleted && page === 2 ? [] : [review], page, deleted ? 20 : 21));
  });
  http.delete.mockImplementation(async () => { deleted = true; return { data: { success: true } }; });
  renderPage();
  await screen.findByText('Minh Anh');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/reviews?page=2&limit=20&sort=-createdAt'));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Xóa đánh giá' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Xóa đánh giá' }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/reviews?page=1&limit=20&sort=-createdAt'));
  expect(await screen.findByText('Minh Anh')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Trang 1' }).getAttribute('aria-current')).toBe('page');
});
