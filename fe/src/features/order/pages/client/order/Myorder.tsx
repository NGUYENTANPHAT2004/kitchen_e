import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useMyOrders } from "../../../hooks/useMyOrders";
import { orderLabels, money } from "../../../order-utils";
import type { Order } from "../../../interface/interface";
import ClientLayout from "../../../../../components/layout/client/ClientLayout";
import RequestState from "../../../../../components/shared/RequestState";

export default function OrdersPage() {
  const [status, setStatus] = useState<Order["status"] | "all">("all");
  const { orders, isLoading, isError, cancelOrder, isCancelling } =
    useMyOrders();
  const rows = orders.filter(
    (order) => status === "all" || order.status === status
  );
  return (
    <ClientLayout>
      <div className="store-container section-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p>
            <h1>Đơn hàng của tôi</h1>
          </div>
          <Link className="text-link" to="/shop/category/all">
            Tiếp tục mua sắm <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="account-tabs">
          {(
            [
              "all",
              "pending",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
            ] as const
          ).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={status === value ? "active" : ""}
            >
              {value === "all" ? "Tất cả" : orderLabels[value]}
            </button>
          ))}
        </div>
        {isLoading || isError || !rows.length ? (
          <RequestState
            loading={isLoading}
            error={isError}
            empty="Bạn chưa có đơn hàng trong mục này."
          />
        ) : (
          rows.map((order) => (
            <article className="order-row" key={order._id}>
              <div>
                <Link
                  className="text-link"
                  to={`/shop/account/orders/${order._id}`}
                >
                  {order.orderNumber}
                  <ArrowUpRight size={14} />
                </Link>
                <small>
                  {new Date(order.createdAt).toLocaleDateString("vi-VN")} ·{" "}
                  {order.items.length} sản phẩm
                </small>
              </div>
              <span className={`status-badge status-${order.status}`}>
                {orderLabels[order.status]}
              </span>
              <strong>{money(order.totalAmount)}</strong>
              <div className="order-actions">
                <Link
                  className="text-link"
                  to={`/shop/account/orders/${order._id}`}
                >
                  Chi tiết
                </Link>
                {["pending", "processing"].includes(order.status) &&
                  !order.isPaid && (
                    <button
                      className="text-link"
                      disabled={isCancelling}
                      onClick={() => {
                        if (confirm("Hủy đơn hàng này?"))
                          cancelOrder(order._id);
                      }}
                    >
                      Hủy đơn
                    </button>
                  )}
              </div>
            </article>
          ))
        )}
      </div>
    </ClientLayout>
  );
}
