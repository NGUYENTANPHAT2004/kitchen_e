import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import orderService from "../services/order-service";
import type { AdminOrderFilters, Order } from "../interface/interface";

export const useAdminOrders = () => {
  const queryClient = useQueryClient();
  const location = useLocation();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filters, setFilters] = useState<AdminOrderFilters>({
    search: "",
    status: "",
    paymentStatus: "",
    dateRange: { start: "", end: "" },
  });

  const queryParams = {
    page: currentPage,
    limit: itemsPerPage,
    ...(filters.search && { search: filters.search }),
    ...(filters.status && { status: filters.status }),
    ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
    ...(filters.dateRange.start && { startDate: filters.dateRange.start }),
    ...(filters.dateRange.end && { endDate: filters.dateRange.end }),
  };

  useEffect(() => {
    const byPath: Record<string, AdminOrderFilters["status"]> = {
      processing: "processing",
      shipping: "shipped",
      completed: "delivered",
      cancelled: "cancelled",
    };
    setFilters((previous) => ({
      ...previous,
      status: byPath[location.pathname.split("/").pop() || ""] || "",
    }));
    setCurrentPage(1);
  }, [location.pathname]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", queryParams],
    queryFn: () => orderService.getOrders(queryParams),
    keepPreviousData: true,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Order["status"] }) =>
      orderService.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Cập nhật trạng thái thành công");
    },
    onError: () => toast.error("Cập nhật thất bại"),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) =>
      orderService.updateOrderStatus(orderId, "cancelled"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Đã hủy đơn hàng");
    },
    onError: () => toast.error("Không thể hủy đơn hàng"),
  });

  const handleFilterChange = useCallback(
    <K extends keyof AdminOrderFilters>(
      key: K,
      value: AdminOrderFilters[K]
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setCurrentPage(1);
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      status: "",
      paymentStatus: "",
      dateRange: { start: "", end: "" },
    });
    setCurrentPage(1);
  }, []);

  return {
    orders,
    pagination,
    isLoading,
    isError,
    refetch,
    filters,
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage: (limit: number) => {
      setItemsPerPage(limit);
      setCurrentPage(1);
    },
    handleFilterChange,
    clearFilters,
    updateStatus: statusMutation.mutate,
    cancelOrder: cancelMutation.mutate,
    isUpdatingStatus: statusMutation.isLoading,
    isCancelling: cancelMutation.isLoading,
  };
};
