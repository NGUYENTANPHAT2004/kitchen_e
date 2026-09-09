import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Printer } from "lucide-react";
import toast from "react-hot-toast";
import ClientLayout from "../../../components/layout/client/ClientLayout";
import RequestState from "../../../components/shared/RequestState";
import { api, urlUtils } from "../../../config/api_cli.config";
import {
  useStoreSettings,
  defaultSettings,
} from "../../store/useStoreSettings";
import orderService from "../services/order-service";
import { itemName, itemProductId, money, orderLabels } from "../order-utils";
import type { Order } from "../interface/interface";

export default function OrderDetail({ admin = false }: { admin?: boolean }) {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const [reference, setReference] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderService.getOrder(id),
    refetchInterval: 30000,
  });
  const { data: settings = defaultSettings } = useStoreSettings();
  const order = query.data;
  const mutation = useMutation({
    mutationFn: (status: Order["status"]) =>
      orderService.updateOrderStatus(id, status),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["order"] });
      client.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Đã cập nhật đơn hàng");
    },
    onError: (e: any) =>
      toast.error(
        e.response?.data?.message ||
          e.response?.data?.error?.message ||
          "Không thể cập nhật đơn hàng."
      ),
  });
  const payment = useMutation({
    mutationFn: () => api.post(`/orders/${id}/confirm-transfer`, { reference }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["order"] });
      toast.success("Đã xác nhận khoản tiền nhận được.");
    },
    onError: () => toast.error("Không thể xác nhận thanh toán."),
  });
  const nextStatus: Partial<Record<Order["status"], Order["status"]>> = {
    pending: "processing",
    processing: "shipped",
    shipped: "delivered",
  };
  const content = (
    <div className={admin ? "admin-form" : "store-container section-space"}>
      <Link
        className="text-link"
        to={admin ? "/orders" : "/shop/account/orders"}
      >
        <ArrowLeft size={15} />
        Danh sách đơn hàng
      </Link>
      {query.isLoading || query.isError || !order ? (
        <RequestState
          loading={query.isLoading}
          error={query.isError}
          retry={() => query.refetch()}
        />
      ) : (
        <>
          <div className="section-heading" style={{ marginTop: 26 }}>
            <div>
              <p className="eyebrow">
                {params.has("placed")
                  ? "CẢM ƠN BẠN ĐÃ ĐẶT HÀNG"
                  : "CHI TIẾT ĐƠN HÀNG"}
              </p>
              <h1>{order.orderNumber}</h1>
              <span className={`status-badge status-${order.status}`}>
                {orderLabels[order.status]}
              </span>
            </div>
            <button
              className="icon-button"
              title="In đơn hàng"
              aria-label="In đơn hàng"
              onClick={() => window.print()}
            >
              <Printer size={21} />
            </button>
          </div>
          <div className="order-detail-grid">
            <div>
              {order.items.map((item) => {
                const productId = itemProductId(item);
                const image =
                  item.productSnapshot?.image ||
                  (typeof item.productId === "object"
                    ? item.productId?.images?.[0]?.url
                    : "");
                return (
                  <div className="cart-line" key={item._id}>
                    <img
                      src={
                        urlUtils.getFullImageUrl(image) ||
                        urlUtils.getFallbackImageUrl()
                      }
                      alt={itemName(item)}
                    />
                    <div className="cart-line-main">
                      {productId ? (
                        <Link to={`/shop/product/${productId}`}>
                          {itemName(item)}
                        </Link>
                      ) : (
                        itemName(item)
                      )}
                      <small>
                        {item.variantSnapshot?.name || item.variantId?.name}
                      </small>
                      <small>Số lượng: {item.quantity}</small>
                      {!admin && productId && order.status === "delivered" && (
                        <Link
                          className="text-link"
                          to={`/shop/product/${productId}#reviews`}
                        >
                          Đánh giá sản phẩm
                        </Link>
                      )}
                    </div>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>
                );
              })}
              <div className="totals">
                <div>
                  <span>Tạm tính</span>
                  <span>{money(order.subtotal || 0)}</span>
                </div>
                <div>
                  <span>Vận chuyển</span>
                  <span>{money(order.shippingCost || 0)}</span>
                </div>
                {!!order.discount && (
                  <div>
                    <span>Ưu đãi</span>
                    <span>-{money(order.discount)}</span>
                  </div>
                )}
                <div>
                  <strong>Tổng cộng</strong>
                  <strong>{money(order.totalAmount)}</strong>
                </div>
              </div>
            </div>
            <div>
              <section className="detail-block">
                <h2>Địa chỉ nhận hàng</h2>
                <strong>{order.shippingAddress?.fullName}</strong>
                <p>{order.shippingAddress?.phone}</p>
                <p>
                  {[
                    order.shippingAddress?.address,
                    order.shippingAddress?.city,
                    order.shippingAddress?.state,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.trackingNumber && (
                  <p>
                    Mã vận đơn: <strong>{order.trackingNumber}</strong>
                  </p>
                )}
              </section>
              <section className="detail-block">
                <h2>Thanh toán</h2>
                <p>
                  {order.isPaid ? "Đã thanh toán" : "Chưa thanh toán"} ·{" "}
                  {order.paymentMethod === "cod"
                    ? "Thanh toán khi nhận hàng"
                    : order.paymentMethod === "bank_transfer"
                    ? "Chuyển khoản ngân hàng"
                    : order.paymentMethod.toUpperCase()}
                </p>
                {order.paymentMethod === "bank_transfer" &&
                  !order.isPaid &&
                  !["cancelled", "refunded"].includes(order.status) && (
                    <>
                      <p>{settings.bankName}</p>
                      <p>
                        Số tài khoản: <strong>{settings.bankAccount}</strong>
                      </p>
                      <p>Chủ tài khoản: {settings.bankAccountName}</p>
                      <p>
                        Nội dung: <strong>{order.orderNumber}</strong>
                      </p>
                      <p>
                        Số tiền: <strong>{money(order.totalAmount)}</strong>
                      </p>
                      {admin && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (
                              confirm(
                                "Xác nhận đã nhận đủ số tiền trong tài khoản ngân hàng?"
                              )
                            )
                              payment.mutate();
                          }}
                        >
                          <label className="field">
                            Mã giao dịch ngân hàng
                            <input
                              required
                              value={reference}
                              minLength={4}
                              maxLength={100}
                              onChange={(e) => setReference(e.target.value)}
                            />
                          </label>
                          <button
                            className="button"
                            style={{ marginTop: 15 }}
                            disabled={payment.isLoading}
                          >
                            <Check size={16} />
                            Xác nhận đã nhận tiền
                          </button>
                        </form>
                      )}
                    </>
                  )}
              </section>
              {admin && (
                <div className="order-actions" style={{ marginTop: 22 }}>
                  {nextStatus[order.status] && (
                    <button
                      className="button"
                      disabled={mutation.isLoading}
                      onClick={() => mutation.mutate(nextStatus[order.status]!)}
                    >
                      {orderLabels[nextStatus[order.status]!]}
                      <ArrowRight size={16} />
                    </button>
                  )}
                  {["pending", "processing"].includes(order.status) &&
                    !order.isPaid && (
                      <button
                        className="button secondary"
                        disabled={mutation.isLoading}
                        onClick={() => {
                          if (confirm("Hủy đơn hàng và hoàn lại tồn kho?"))
                            mutation.mutate("cancelled");
                        }}
                      >
                        Hủy đơn
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
  return admin ? content : <ClientLayout>{content}</ClientLayout>;
}
