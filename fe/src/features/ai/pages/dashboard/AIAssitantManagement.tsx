import React, { useState } from 'react';
import {
  Bot, MessageSquare, BarChart2, Settings,
  AlertTriangle, CheckCircle, ChevronDown, Tag,
  Search, Info
} from 'lucide-react';
import {
  useIntentDistribution,
  useFeedbackStats,
  useFrequentQueries,
  useChatHistory,
} from '../../hooks/useAI';

// Intent được phân loại bởi AI service (Python) và KHÔNG expose CRUD qua Node API.
// Chỉ có endpoint đọc phân phối intent (read-only). Map nhãn hiển thị tiếng Việt.
const INTENT_LABELS: Record<string, string> = {
  greeting: 'Chào hỏi',
  product_inquiry: 'Hỏi về sản phẩm',
  order_status: 'Trạng thái đơn hàng',
  cooking_tips: 'Mẹo nấu ăn',
  product_recommendation: 'Gợi ý sản phẩm',
  general: 'Chung',
  error: 'Lỗi / không hiểu',
  face_auth: 'Xác thực khuôn mặt',
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const BackendNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
    <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-blue-800">{children}</div>
  </div>
);

const AIAssistantManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'intents' | 'settings'>('overview');

  // Conversations tab: chat history requires a sessionId or userId
  const [historyMode, setHistoryMode] = useState<'session' | 'user'>('session');
  const [historyInput, setHistoryInput] = useState('');
  const [historyQuery, setHistoryQuery] = useState<{ sessionId?: string; userId?: string } | null>(null);

  // Overview analytics (admin endpoints)
  const intentDist = useIntentDistribution();
  const feedbackStats = useFeedbackStats();
  const frequentQueries = useFrequentQueries(10);

  const distItems = intentDist.data ?? [];
  const totalIntents = distItems.reduce((sum, d) => sum + d.count, 0);
  const errorCount = distItems.find((d) => d._id === 'error')?.count ?? 0;

  const fbItems = feedbackStats.data ?? [];
  const helpfulCount = fbItems.find((f) => f._id === true)?.count ?? 0;
  const notHelpfulCount = fbItems.find((f) => f._id === false)?.count ?? 0;
  const totalFeedback = helpfulCount + notHelpfulCount;
  const helpfulRate = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0;

  const freqItems = frequentQueries.data ?? [];

  // Chat history
  const chatHistory = useChatHistory({ ...historyQuery, limit: 50 });
  const historyItems = chatHistory.data?.history ?? [];

  const handleHistorySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const value = historyInput.trim();
    if (!value) {
      setHistoryQuery(null);
      return;
    }
    setHistoryQuery(historyMode === 'session' ? { sessionId: value } : { userId: value });
  };

  // Phân phối intent thật (read-only) — sắp theo số lượt giảm dần
  const intentRows = [...distItems].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Bot className="mr-2" size={24} />
          Trợ lý AI
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Tổng quan', icon: BarChart2 },
            { key: 'conversations', label: 'Lịch sử hội thoại', icon: MessageSquare },
            { key: 'intents', label: 'Quản lý Intent', icon: Tag },
            { key: 'settings', label: 'Cài đặt', icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="mr-2 h-5 w-5 inline-block" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {intentDist.isError || feedbackStats.isError || frequentQueries.isError ? (
            <BackendNotice>
              Không tải được dữ liệu phân tích. Các endpoint này yêu cầu quyền admin
              (<span className="font-medium">/ai/analytics/*</span>, <span className="font-medium">/ai/chat/frequent-queries</span>).
            </BackendNotice>
          ) : (
            <BackendNotice>
              Số liệu dưới đây được tổng hợp từ log tương tác AI thực tế (bảng AIAssistantLog).
              Các endpoint yêu cầu quyền admin.
            </BackendNotice>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Tổng hội thoại</p>
                  <h3 className="text-2xl font-bold text-gray-800 mt-1">
                    {intentDist.isLoading ? '...' : totalIntents.toLocaleString()}
                  </h3>
                </div>
                <div className="bg-indigo-100 p-3 rounded-full">
                  <MessageSquare className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className="text-sm text-gray-500">Tổng số truy vấn đã ghi log</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Phản hồi hữu ích</p>
                  <h3 className="text-2xl font-bold text-gray-800 mt-1">
                    {feedbackStats.isLoading ? '...' : `${helpfulRate}%`}
                  </h3>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className="text-sm text-gray-500">{helpfulCount}/{totalFeedback} phản hồi hữu ích</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Phản hồi không hữu ích</p>
                  <h3 className="text-2xl font-bold text-gray-800 mt-1">
                    {feedbackStats.isLoading ? '...' : notHelpfulCount}
                  </h3>
                </div>
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className="text-sm text-gray-500">Cần cải thiện phản hồi</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Không hiểu intent</p>
                  <h3 className="text-2xl font-bold text-gray-800 mt-1">
                    {intentDist.isLoading ? '...' : errorCount}
                  </h3>
                </div>
                <div className="bg-yellow-100 p-3 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className="text-sm text-gray-500">
                  {totalIntents > 0 ? ((errorCount / totalIntents) * 100).toFixed(1) : '0'}% tổng truy vấn
                </span>
              </div>
            </div>
          </div>

          {/* Distribution + Frequent queries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Phân bố Intent</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intent</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {intentDist.isLoading ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">Đang tải...</td></tr>
                    ) : distItems.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">Chưa có dữ liệu.</td></tr>
                    ) : (
                      distItems.map((item) => {
                        const pct = totalIntents > 0 ? (item.count / totalIntents) * 100 : 0;
                        return (
                          <tr key={item._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{item._id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{item.count}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              {pct.toFixed(1)}%
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${pct.toFixed(1)}%` }}></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Truy vấn phổ biến</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Truy vấn</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intent</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gần nhất</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {frequentQueries.isLoading ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Đang tải...</td></tr>
                    ) : freqItems.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Chưa có dữ liệu.</td></tr>
                    ) : (
                      freqItems.map((query, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{query.query}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                              {query.intent_types?.[0] ?? '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{query.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {formatDateTime(query.last_asked)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="space-y-6">
          <BackendNotice>
            API lịch sử hội thoại (<span className="font-medium">GET /ai/chat/history</span>) yêu cầu tra cứu theo
            <span className="font-medium"> Session ID</span> hoặc <span className="font-medium">User ID</span> cụ thể
            (backend chưa có endpoint liệt kê toàn bộ hội thoại).
          </BackendNotice>

          {/* Search bar */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <form className="flex flex-col md:flex-row md:items-center gap-4" onSubmit={handleHistorySearch}>
              <div className="relative">
                <select
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[140px]"
                  value={historyMode}
                  onChange={(e) => setHistoryMode(e.target.value as 'session' | 'user')}
                >
                  <option value="session">Theo Session ID</option>
                  <option value="user">Theo User ID</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder={historyMode === 'session' ? 'Nhập Session ID...' : 'Nhập User ID...'}
                  className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={historyInput}
                  onChange={(e) => setHistoryInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Tra cứu
              </button>
            </form>
          </div>

          {/* Conversation Logs */}
          <div className="bg-white shadow-sm rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Truy vấn</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intent</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phản hồi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!historyQuery ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">Nhập Session ID hoặc User ID rồi bấm Tra cứu.</td></tr>
                  ) : chatHistory.isLoading ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">Đang tải...</td></tr>
                  ) : chatHistory.isError ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-red-500">Không thể tải lịch sử. Kiểm tra ID hoặc quyền truy cập.</td></tr>
                  ) : historyItems.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">Không có hội thoại nào.</td></tr>
                  ) : (
                    historyItems.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.created_at)}</td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">{log.query}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {log.query_source}
                            </span>
                            {log.response_time != null && <span className="ml-2">{log.response_time} ms</span>}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.intent_type === 'error' ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {log.intent_type}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">{log.response}</div>
                          {log.feedback && (
                            <div className="text-xs mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.feedback.isHelpful ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {log.feedback.isHelpful ? 'Hữu ích' : 'Không hữu ích'}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Intents Tab */}
      {activeTab === 'intents' && (
        <div className="space-y-6">
          <BackendNotice>
            Intent được phân loại tự động bởi AI service (Python) và <span className="font-medium">chưa expose CRUD qua API</span>.
            Bảng dưới đây là <span className="font-medium">phân phối intent thật</span> tổng hợp từ nhật ký hội thoại (chỉ đọc).
          </BackendNotice>

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Phân phối Intent</h2>
            {intentDist.isLoading && <span className="text-sm text-gray-500">Đang tải...</span>}
          </div>

          <div className="bg-white shadow-sm rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Số lượt</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tỉ lệ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {intentRows.map((row) => (
                    <tr key={row._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{INTENT_LABELS[row._id] ?? row._id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Tag className="h-3 w-3" />{row._id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">{row.count.toLocaleString('vi-VN')}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {totalIntents > 0 ? `${Math.round((row.count / totalIntents) * 100)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                  {intentRows.length === 0 && !intentDist.isLoading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                        Chưa có dữ liệu intent
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <BackendNotice>
            Backend hiện <span className="font-medium">chưa có endpoint lưu cấu hình AI</span>. Các tùy chọn dưới đây
            chỉ hiển thị giao diện; cần thêm endpoint settings để lưu thay đổi.
          </BackendNotice>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Cài đặt AI (chưa nối backend)</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="model-version" className="block text-sm font-medium text-gray-700">Phiên bản mô hình</label>
                <select
                  id="model-version"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  defaultValue="default"
                >
                  <option value="default">Mặc định</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
              </div>
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700">Temperature (0-1)</label>
                <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" id="temperature" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
            <div className="flex justify-end pt-6">
              <button type="button" disabled className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-400 cursor-not-allowed">
                Lưu thay đổi (chưa khả dụng)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistantManagement;
