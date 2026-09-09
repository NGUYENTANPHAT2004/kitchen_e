import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package, ShoppingCart, Tag } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, urlUtils } from "../../config/api_cli.config";
import orderService from "../../features/order/services/order-service";
import { productService } from "../../features/products/services/productService";
import type { Product } from "../../features/products/services/productService";
import { money, orderLabels } from "../../features/order/order-utils";
import RequestState from "../../components/shared/RequestState";

interface Sales {
  summary: {
    orders: number;
    revenue: number;
    orderValue: number;
    unpaid: number;
  };
  daily: { _id: string; revenue: number }[];
}
export default function Dashboard() {
  const sales = useQuery<Sales>({
    queryKey: ["dashboard-sales"],
    queryFn: async () => (await api.get("/reports/sales")).data.data,
  });
  const orders = useQuery({
    queryKey: ["dashboard-orders"],
    queryFn: () =>
      orderService.getOrders({ page: 1, limit: 5, sort: "-createdAt" }),
  });
  const products = useQuery({
    queryKey: ["dashboard-products"],
    queryFn: () => productService.getProducts({ featured: true, limit: 4 }),
  });
  const totals = sales.data?.summary;
  return (
    <div className="dashboard-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">30 NGÀY GẦN NHẤT</p>
          <h1>Tổng quan cửa hàng</h1>
        </div>
        <Link className="button secondary" to="/reports/sales">
          Báo cáo
          <ArrowRight size={16} />
        </Link>
      </div>
      {sales.isLoading || sales.isError ? (
        <RequestState
          loading={sales.isLoading}
          error={sales.isError}
          retry={() => sales.refetch()}
        />
      ) : (
        <>
          <div className="report-stats">
            {[
              ["Tiền đã thu", money(totals?.revenue || 0)],
              ["Đơn hàng hợp lệ", totals?.orders || 0],
              ["Giá trị đơn hàng", money(totals?.orderValue || 0)],
              ["Chưa thanh toán", money(totals?.unpaid || 0)],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <section className="dashboard-section">
            <h2>Tiền đã thu theo ngày</h2>
            <div className="report-chart">
              {sales.data?.daily.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales.data.daily}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e3e8df"
                    />
                    <XAxis
                      dataKey="_id"
                      tickFormatter={(date) => date.slice(5)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      width={65}
                      tickFormatter={(value) => `${value / 1000}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        money(value),
                        "Tiền đã thu",
                      ]}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#3b7553"
                      maxBarSize={45}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <RequestState empty="Chưa có giao dịch trong kỳ." />
              )}
            </div>
          </section>
        </>
      )}
      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Đơn hàng gần đây</h2>
          <Link className="text-link" to="/orders">
            Xem tất cả
            <ArrowRight size={16} />
          </Link>
        </div>
        {orders.isLoading || orders.isError ? (
          <RequestState
            loading={orders.isLoading}
            error={orders.isError}
            retry={() => orders.refetch()}
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Ngày đặt</th>
                  <th>Trạng thái</th>
                  <th>Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {orders.data?.orders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <Link className="text-link" to={`/orders/${order._id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      {order.shippingAddress?.fullName ||
                        order.userId?.username}
                    </td>
                    <td>
                      {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {orderLabels[order.status]}
                      </span>
                    </td>
                    <td>{money(order.totalAmount)}</td>
                  </tr>
                ))}
                {!orders.data?.orders.length && (
                  <tr>
                    <td colSpan={5}>Chưa có đơn hàng</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Sản phẩm nổi bật</h2>
          <Link className="text-link" to="/products">
            Quản lý sản phẩm
            <ArrowRight size={16} />
          </Link>
        </div>
        {products.isLoading || products.isError ? (
          <RequestState
            loading={products.isLoading}
            error={products.isError}
            retry={() => products.refetch()}
          />
        ) : (
          <div className="dashboard-products">
            {(products.data?.data?.products || []).map((product: Product) => (
              <Link
                key={product._id}
                className="dashboard-product"
                to={`/products/${product._id}`}
              >
                <img
                  src={
                    urlUtils.getFullImageUrl(product.images[0]?.url) ||
                    urlUtils.getFallbackImageUrl()
                  }
                  alt={product.name}
                />
                <div>
                  <strong>{product.name}</strong>
                  <small>
                    {money(product.basePrice)} · {product.stockQuantity} tồn kho
                  </small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <nav className="dashboard-shortcuts">
        <Link className="text-link" to="/products/add">
          <Package size={18} />
          Thêm sản phẩm
        </Link>
        <Link className="text-link" to="/orders">
          <ShoppingCart size={18} />
          Xử lý đơn hàng
        </Link>
        <Link className="text-link" to="/marketing/vouchers">
          <Tag size={18} />
          Mã giảm giá
        </Link>
      </nav>
    </div>
  );
}
