// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TrainingStatus } from '../features/ai/services/trainingService';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const auth = vi.hoisted(() => ({ state: { loading: false, user: null as null | { _id: string } } }));
vi.mock('../config/api_cli.config', async (importOriginal) => ({ ...await importOriginal<typeof import('../config/api_cli.config')>(), api: http }));
vi.mock('../features/auth/hooks/auth-hook', () => ({ useAuth: () => auth }));
import AIChatPanel from '../features/ai/pages/dashboard/AIChatPanel';
import AIModelPanel from '../features/ai/pages/dashboard/AIModelPanel';
import AIExamplesPanel from '../features/ai/pages/dashboard/AIExamplesPanel';
import { aiError } from '../features/ai/services/trainingService';

const envelope = (data: unknown) => ({ data: { data } });
const clients: QueryClient[] = [];
function view(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } }, logger: { log: console.log, warn: console.warn, error: vi.fn() } });
  clients.push(client);
  const wrap = (node: ReactNode) => <MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>;
  const result = render(wrap(element));
  return { ...result, rerender: (node: ReactNode) => result.rerender(wrap(node)), client };
}
const settings = { autoTrain: false, minChanges: 5, intervalMinutes: 60, minF1: 0.65, minConfidence: 0.4 };
const blank: TrainingStatus = { settings, activeVersionId: null, runningJobId: null, versions: [], trainingSamples: 84, validationSamples: 24, pendingSamples: 0, pendingChanges: 1 };
const version = { id: 'v1', name: 'intent-test', status: 'ready' as const, trigger: 'manual' as const, createdAt: '2026-09-08T00:00:00Z', metrics: { macroF1: 0.95, accuracy: 0.96, trainingSamples: 84, validationSamples: 24, perIntent: [], mistakes: [{ text: 'Shop có freeship không', actual: 'shipping_policy', predicted: 'greeting' }] } };
const reply = { session_id: 'session-first', session_token: 'signed-first', log_id: 'log-1', response: 'Mời bạn xem chảo', intent_type: 'product_inquiry', suggested_products: [{ id: 'product-1', name: 'Chảo chống dính', price: 250000, image: null }], suggested_actions: [{ text: 'Đơn hàng', action: 'track_order' }] };

beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); auth.state.user = null; });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); });

it.each([{ message: 'Lỗi kết nối' }, { error: 'Lỗi kết nối' }, { error: { message: 'Lỗi kết nối' } }])('reads the backend error shape %j', data => {
  expect(aiError({ isAxiosError: true, response: { data } })).toBe('Lỗi kết nối');
  expect(aiError(new Error('offline'))).toContain('Vui lòng thử lại');
});

it('trains a candidate, shows its errors and activates it only after evaluation', async () => {
  let status = { ...blank };
  http.get.mockImplementation(async () => envelope(status));
  http.post.mockImplementation(async (path: string) => {
    status = path.endsWith('/train') ? { ...blank, versions: [version] } : { ...blank, versions: [version], activeVersionId: version.id };
    return envelope({});
  });
  view(<AIModelPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Huấn luyện phiên bản mới' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt phiên bản' }));
  expect(await screen.findByText('Đang sử dụng')).toBeTruthy();
  expect(http.post).toHaveBeenNthCalledWith(1, '/ai/training/train');
  expect(http.post).toHaveBeenNthCalledWith(2, '/ai/training/versions/v1/activate');
  expect(screen.getByText('“Shop có freeship không”')).toBeTruthy();
});

it('prevents a second running training job and activation of a model below the threshold', async () => {
  http.get.mockResolvedValue(envelope({ ...blank, runningJobId: 'job', versions: [{ ...version, metrics: { ...version.metrics, macroF1: 0.4 } }] }));
  view(<AIModelPanel />);
  expect((await screen.findByRole('button', { name: 'Đang huấn luyện…' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Kích hoạt phiên bản' }) as HTMLButtonElement).disabled).toBe(true);
});

it('shows a training error from the real backend error field', async () => {
  http.get.mockResolvedValue(envelope(blank));
  http.post.mockRejectedValue({ isAxiosError: true, response: { data: { error: 'Một lượt huấn luyện đang chạy.' } } });
  view(<AIModelPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Huấn luyện phiên bản mới' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Một lượt huấn luyện đang chạy.');
});

it('keeps a duplicate example editable and sends the human-selected label and dataset split', async () => {
  http.get.mockImplementation(async (path: string) => envelope(path.endsWith('/intents') ? { intents: [{ key: 'products', label: 'Sản phẩm', enabled: true }] } : { examples: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 1 } }));
  http.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'Câu mẫu đã tồn tại.' } } }).mockResolvedValue(envelope({}));
  view(<AIExamplesPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Thêm câu mẫu' }));
  await screen.findAllByRole('option', { name: 'Sản phẩm' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Câu hỏi mẫu' }), { target: { value: 'Có chảo vuông không' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Nhãn intent' }), { target: { value: 'products' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Dùng cho' }), { target: { value: 'validation' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu câu mẫu' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Câu mẫu đã tồn tại.');
  expect((screen.getByRole('textbox', { name: 'Câu hỏi mẫu' }) as HTMLTextAreaElement).value).toBe('Có chảo vuông không');
  fireEvent.change(screen.getByRole('textbox', { name: 'Câu hỏi mẫu' }), { target: { value: 'Chảo vuông còn hàng không' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu câu mẫu' }));
  await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Câu hỏi mẫu' })).toBeNull());
  expect(http.post).toHaveBeenLastCalledWith('/ai/training/examples', { text: 'Chảo vuông còn hàng không', intent: 'products', purpose: 'validation', approved: true });
});

it('continues a signed conversation, links actual products and resets for another account', async () => {
  http.get.mockResolvedValue(envelope({ enabled: true, connected: true }));
  http.post.mockImplementation(async (path: string) => envelope(path.includes('/feedback/') ? {} : reply));
  const page = view(<AIChatPanel />);
  fireEvent.change(await screen.findByRole('textbox', { name: 'Tin nhắn cho trợ lý' }), { target: { value: 'Tìm chảo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
  expect(await screen.findByText('Mời bạn xem chảo')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Chảo chống dính/ }).getAttribute('href')).toBe('/shop/product/product-1');
  expect(screen.getByRole('link', { name: 'Đơn hàng' }).getAttribute('href')).toBe('/shop/account/orders');
  fireEvent.click(screen.getByRole('button', { name: 'Câu trả lời hữu ích' }));
  expect(await screen.findByText('Đã ghi nhận')).toBeTruthy();
  expect(http.post).toHaveBeenLastCalledWith('/ai/feedback/log-1', { isHelpful: true, sessionToken: 'signed-first' });
  http.post.mockResolvedValue(envelope({ ...reply, log_id: 'log-2', response: 'Chảo nhỏ hơn' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' }), { target: { value: 'Loại nhỏ hơn' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
  expect(await screen.findByText('Chảo nhỏ hơn')).toBeTruthy();
  expect(http.post).toHaveBeenLastCalledWith('/ai/chat', { message: 'Loại nhỏ hơn', sessionId: 'session-first', sessionToken: 'signed-first' });
  auth.state.user = { _id: 'different-customer' };
  page.rerender(<AIChatPanel />);
  expect(await screen.findByText('Bạn cần gì cho căn bếp?')).toBeTruthy();
  expect(screen.queryByText('Mời bạn xem chảo')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' }), { target: { value: 'Xin chào' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
  await waitFor(() => expect(http.post).toHaveBeenLastCalledWith('/ai/chat', { message: 'Xin chào' }));
});

it('restores history in time order without marking empty feedback as rated and can start a new session', async () => {
  sessionStorage.setItem('kitchen-ai-session:guest', JSON.stringify({ id: 'old', token: 'signed-old' }));
  http.get.mockImplementation(async (path: string) => envelope(path.endsWith('/history') ? { history: [{ id: 'new', query: 'Mới', response: 'Mới trả lời', feedback: {} }, { id: 'old', query: 'Cũ', response: 'Cũ trả lời' }], count: 2 } : { enabled: true, connected: true }));
  http.post.mockResolvedValue(envelope(reply));
  view(<AIChatPanel />);
  await screen.findByText('Mới trả lời');
  expect(screen.getByRole('log').textContent!.indexOf('Cũ')).toBeLessThan(screen.getByRole('log').textContent!.indexOf('Mới'));
  expect(screen.queryByText('Đã ghi nhận')).toBeNull();
  expect(http.get).toHaveBeenCalledWith('/ai/chat/history', { params: { sessionId: 'old', limit: 100 }, headers: { 'X-Chat-Token': 'signed-old' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' }), { target: { value: 'Chào' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
  await waitFor(() => expect(http.post).toHaveBeenLastCalledWith('/ai/chat', { message: 'Chào' }));
});

it('keeps chat disabled when Python is disconnected', async () => {
  http.get.mockResolvedValue(envelope({ enabled: true, connected: false }));
  view(<AIChatPanel />);
  expect((await screen.findByRole('textbox', { name: 'Tin nhắn cho trợ lý' }) as HTMLTextAreaElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Kết nối lại' })).toBeTruthy();
  expect(http.post).not.toHaveBeenCalled();
});
