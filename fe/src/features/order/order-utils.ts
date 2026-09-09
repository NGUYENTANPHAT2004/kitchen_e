import type { Order, OrderItem } from "./interface/interface";
export const orderLabels: Record<Order["status"], string> = {
  pending: "Chờ xác nhận",
  processing: "Đang chuẩn bị",
  shipped: "Đang giao hàng",
  delivered: "Đã giao hàng",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};
export const itemName = (item: OrderItem) =>
  item.productSnapshot?.name ||
  (typeof item.productId === "object" ? item.productId?.name : "") ||
  "Sản phẩm";
export const itemProductId = (item: OrderItem) =>
  typeof item.productId === "object" ? item.productId?._id : item.productId;
export const money = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;
