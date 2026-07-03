import React, { useState } from 'react';
import {
  Zap, Search, Filter, Calendar, ArrowUpDown, Eye, Edit,
  Trash2, ChevronLeft, ChevronRight, PlusCircle,
  Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useFlashSales,
  useDeleteFlashSale,
  useUpdateFlashSaleStatus,
} from '../../hooks/useFlashSales';
import type { FlashSale } from '../../interface/interface';

const STATUS_LABELS: Record<FlashSale['status'], string> = {
  scheduled: 'Đã lên lịch',
  active: 'Đang hoạt động',
  ended: 'Đã kết thúc',
  cancelled: 'Đã hủy',
};

const StatusBadge: React.FC<{ status: FlashSale['status'] }> = ({ status }) => {
  const map: Record<FlashSale['status'], { bg: string; text: string; icon: React.ReactNode }> = {
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock size={14} className="mr-1" /> },
    active: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle size={14} className="mr-1" /> },
    ended: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <AlertTriangle size={14} className="mr-1" /> },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle size={14} className="mr-1" /> },
  };
  const { bg, text, icon } = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-800', icon: null };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}{STATUS_LABELS[status] ?? status}
    </span>
  );
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const FlashSaleList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FlashSale['status'] | ''>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, page, setPage } = useFlashSales({
    status: filterStatus || undefined,
    search: searchTerm || undefined,
  });

  const deleteMutation = useDeleteFlashSale();
  const statusMutation = useUpdateFlashSaleStatus();

  const flashSales: FlashSale[] = data?.flashSales ?? [];
  const pagination = data?.pagination;

  const sorted = [...flashSales].sort((a: any, b: any) => {
    if (a[sortField] < b[sortField]) return sortDir === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Xóa chương trình Flash Sale này?')) deleteMutation.mutate(id);
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Xóa ${selectedIds.length} chương trình?`)) return;
    selectedIds.forEach(id => deleteMutation.mutate(id));
    setSelectedIds([]);
  };

  const handleToggleStatus = (sale: FlashSale) => {
    const next: FlashSale['status'] = sale.status === 'active' ? 'ended' : 'active';
    statusMutation.mutate({ id: sale._id, status: next });
  };

  const SortHeader: React.FC<{ field: string; label: string }> = ({ field, label }) => (
    <div className="flex items-center cursor-pointer" onClick={() => handleSort(field)}>
      {label}
      {sortField === field && (
        <ArrowUpDown className={`ml-1 h-4 w-4 text-indigo-600 ${sortDir === 'desc' ? 'rotate-180' : ''}`} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Zap className="mr-2" size={24} />
          Quản lý Flash Sale
        </h1>
        <Link
          to="/marketing/flash-sales/add"
          className="mt-3 sm:mt-0 inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          <PlusCircle size={16} className="mr-1" /> Thêm Flash Sale
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm Flash Sale..."
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value as FlashSale['status'] | ''); setPage(1); }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="active">Đang hoạt động</option>
              <option value="ended">Đã kết thúc</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => { setSearchTerm(''); setFilterStatus(''); }} className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600">
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-md flex items-center justify-between">
          <span className="text-indigo-700 font-medium">{selectedIds.length} đã chọn</span>
          <button onClick={handleBulkDelete} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 flex items-center gap-1">
            <Trash2 className="h-4 w-4" /> Xóa đã chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Không có Flash Sale nào</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    onChange={e => setSelectedIds(e.target.checked ? sorted.map(s => s._id) : [])}
                    checked={selectedIds.length === sorted.length && sorted.length > 0} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="name" label="Tên" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="startDate" label="Thời gian" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="status" label="Trạng thái" />
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorted.map(sale => (
                <tr key={sale._id} className="hover:bg-gray-50">
                  <td className="px-3 py-4">
                    <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      checked={selectedIds.includes(sale._id)}
                      onChange={() => setSelectedIds(ids =>
                        ids.includes(sale._id) ? ids.filter(i => i !== sale._id) : [...ids, sale._id]
                      )} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{sale.name}</div>
                        {sale.description && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{sale.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-sm text-gray-900 flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(sale.startDate)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">→ {formatDate(sale.endDate)}</div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-700">{sale.priority}</td>
                  <td className="px-3 py-4">
                    <StatusBadge status={sale.status} />
                    {sale.isCurrentlyActive && (
                      <div className="text-xs text-green-600 mt-0.5">Đang diễn ra</div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link to={`/marketing/flash-sales/${sale._id}`} className="text-indigo-600 hover:text-indigo-900" title="Xem">
                        <Eye className="h-5 w-5" />
                      </Link>
                      <Link to={`/marketing/flash-sales/${sale._id}/edit`} className="text-blue-600 hover:text-blue-900" title="Sửa">
                        <Edit className="h-5 w-5" />
                      </Link>
                      {(sale.status === 'scheduled' || sale.status === 'active') && (
                        <button
                          onClick={() => handleToggleStatus(sale)}
                          disabled={statusMutation.isLoading}
                          className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                          title={sale.status === 'active' ? 'Kết thúc' : 'Kích hoạt'}
                        >
                          {sale.status === 'active' ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                        </button>
                      )}
                      <button onClick={() => handleDelete(sale._id)} disabled={deleteMutation.isLoading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50" title="Xóa">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Trang <span className="font-medium">{page}</span> / <span className="font-medium">{pagination.totalPages}</span>
            {' '}— tổng <span className="font-medium">{pagination.totalItems}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let n: number;
              if (pagination.totalPages <= 5) n = i + 1;
              else if (page <= 3) n = i + 1;
              else if (page >= pagination.totalPages - 2) n = pagination.totalPages - 4 + i;
              else n = page - 2 + i;
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`px-3 py-2 border rounded-md text-sm ${page === n ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashSaleList;
