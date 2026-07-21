import React, { useState } from 'react';
import {
  Tag, Search, ArrowUpDown, PlusCircle, Edit,
  Trash2, Copy, ChevronLeft, ChevronRight, Filter,
  Percent, DollarSign
} from 'lucide-react';
import {
  useVouchers,
  useCreateVoucher,
  useUpdateVoucher,
  useDeleteVoucher,
} from '../../hooks/useVouchers';
import type { Voucher, VoucherFormData } from '../../interface/interface';

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0 }).format(n);

const EMPTY_FORM: VoucherFormData = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  minOrderValue: 0,
  maxUsage: 0,
  startDate: '',
  endDate: '',
  isActive: true,
  isPrivate: false,
};

const VoucherManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<'' | 'percentage' | 'fixed'>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal] = useState(false);
  const [editVoucher, setEditVoucher] = useState<Voucher | null>(null);
  const [form, setForm] = useState<VoucherFormData>(EMPTY_FORM);

  const isActiveFilter =
    filterStatus === 'active' ? true :
    filterStatus === 'inactive' ? false :
    undefined;

  const { data, isLoading, page, setPage } = useVouchers({
    search: searchTerm || undefined,
    isActive: isActiveFilter,
    discountType: filterType || undefined,
  });

  const createMutation = useCreateVoucher();
  const updateMutation = useUpdateVoucher();
  const deleteMutation = useDeleteVoucher();

  const vouchers: Voucher[] = data?.vouchers ?? [];
  const pagination = data?.pagination;

  const sorted = [...vouchers].sort((a: any, b: any) => {
    if (a[sortField] < b[sortField]) return sortDir === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleOpenAdd = () => {
    setEditVoucher(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (v: Voucher) => {
    setEditVoucher(v);
    setForm({
      code: v.code,
      description: v.description ?? '',
      discountType: v.discountType,
      discountValue: v.discountValue,
      minOrderValue: v.minOrderValue,
      maxUsage: v.maxUsage,
      startDate: v.startDate.split('T')[0],
      endDate: v.endDate.split('T')[0],
      isActive: v.isActive,
      isPrivate: v.isPrivate,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editVoucher) {
      updateMutation.mutate({ id: editVoucher._id, data: form }, { onSuccess: () => setShowModal(false) });
    } else {
      createMutation.mutate(form, { onSuccess: () => setShowModal(false) });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Xóa mã giảm giá này?')) deleteMutation.mutate(id);
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Xóa ${selectedIds.length} mã giảm giá?`)) return;
    selectedIds.forEach(id => deleteMutation.mutate(id));
    setSelectedIds([]);
  };

  const handleToggleStatus = (v: Voucher) => {
    updateMutation.mutate({ id: v._id, data: { isActive: !v.isActive } });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
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
          <Tag className="mr-2" size={24} />
          Quản lý mã giảm giá
        </h1>
        <button
          onClick={handleOpenAdd}
          className="mt-3 sm:mt-0 inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          <PlusCircle size={16} className="mr-1" /> Thêm mã giảm giá
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, mô tả..."
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã tắt</option>
            </select>
            <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
              value={filterType}
              onChange={e => { setFilterType(e.target.value as '' | 'percentage' | 'fixed'); setPage(1); }}
            >
              <option value="">Tất cả loại</option>
              <option value="percentage">Giảm theo %</option>
              <option value="fixed">Giảm số tiền cố định</option>
            </select>
            <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterType(''); }} className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600">
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-md flex items-center justify-between">
          <span className="text-indigo-700 font-medium">{selectedIds.length} mã đã chọn</span>
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
          <div className="p-8 text-center text-gray-500">Không có mã giảm giá nào</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    onChange={e => setSelectedIds(e.target.checked ? sorted.map(v => v._id) : [])}
                    checked={selectedIds.length === sorted.length && sorted.length > 0} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="code" label="Mã giảm giá" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mô tả</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="discountValue" label="Giảm giá" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="minOrderValue" label="Đơn tối thiểu" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="currentUsage" label="Sử dụng" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="endDate" label="Thời hạn" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="isActive" label="Trạng thái" />
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorted.map(voucher => {
                const isExpired = new Date(voucher.endDate) < new Date();
                return (
                  <tr key={voucher._id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        checked={selectedIds.includes(voucher._id)}
                        onChange={() => setSelectedIds(ids =>
                          ids.includes(voucher._id) ? ids.filter(i => i !== voucher._id) : [...ids, voucher._id]
                        )} />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-indigo-600">{voucher.code}</span>
                        <button onClick={() => copyToClipboard(voucher.code)} className="text-gray-400 hover:text-gray-600" title="Sao chép">
                          <Copy className="h-4 w-4" />
                        </button>
                        {voucher.isPrivate && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Riêng tư</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-700">{voucher.description ?? '—'}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        {voucher.discountType === 'percentage' ? (
                          <><Percent className="h-4 w-4 mr-1 text-green-500" />{voucher.discountValue}%</>
                        ) : (
                          <><DollarSign className="h-4 w-4 mr-1 text-green-500" />{formatVND(voucher.discountValue)}</>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-700">{formatVND(voucher.minOrderValue)}</td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{voucher.currentUsage}</span> / {voucher.maxUsage || '∞'}
                      </div>
                      {voucher.maxUsage > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (voucher.currentUsage / voucher.maxUsage) * 100)}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900">{formatDate(voucher.startDate)} — {formatDate(voucher.endDate)}</div>
                      {isExpired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">Hết hạn</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        onClick={() => handleToggleStatus(voucher)}
                        disabled={isExpired || updateMutation.isLoading}
                        className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                          voucher.isActive && !isExpired ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
                          voucher.isActive && !isExpired ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleOpenEdit(voucher)} className="text-blue-600 hover:text-blue-900" title="Sửa">
                          <Edit className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDelete(voucher._id)} disabled={deleteMutation.isLoading}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50" title="Xóa">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editVoucher ? 'Cập nhật mã giảm giá' : 'Thêm mã giảm giá'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã <span className="text-red-500">*</span></label>
                    <input required type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 uppercase" placeholder="VD: SUMMER20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại giảm giá</label>
                    <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="percentage">Phần trăm (%)</option>
                      <option value="fixed">Số tiền cố định</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                  <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Mô tả ngắn" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giá trị giảm {form.discountType === 'percentage' ? '(%)' : '(VNĐ)'} <span className="text-red-500">*</span>
                    </label>
                    <input required type="number" min={1} value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn hàng tối thiểu (VNĐ)</label>
                    <input type="number" min={0} value={form.minOrderValue} onChange={e => setForm(f => ({ ...f, minOrderValue: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu <span className="text-red-500">*</span></label>
                    <input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc <span className="text-red-500">*</span></label>
                    <input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số lần dùng tối đa (0 = không giới hạn)</label>
                    <input type="number" min={0} value={form.maxUsage} onChange={e => setForm(f => ({ ...f, maxUsage: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                      <span className="text-sm text-gray-700">Kích hoạt</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.isPrivate} onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                      <span className="text-sm text-gray-700">Riêng tư</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">Hủy</button>
                  <button type="submit" disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50">
                    {editVoucher ? 'Cập nhật' : 'Tạo mã'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherManagement;
