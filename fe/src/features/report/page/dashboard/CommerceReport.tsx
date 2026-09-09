import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "../../../../config/api_cli.config";
import RequestState from "../../../../components/shared/RequestState";
import { downloadCsv } from "../../../../utils/download";
import { money } from "../../../order/order-utils";

interface SalesData {
  summary: {
    orders: number;
    revenue: number;
    orderValue: number;
    unpaid: number;
  };
  daily: { _id: string; orders: number; revenue: number }[];
  topProducts: {
    _id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
}
interface CustomerData {
  summary: { total: number; newCustomers: number; verified: number };
  daily: { _id: string; count: number }[];
  customers: {
    _id: string;
    firstName?: string;
    lastName?: string;
    username: string;
    email: string;
    orders: number;
    spent: number;
  }[];
}
export default function CommerceReport({
  mode,
}: {
  mode: "sales" | "customers" | "bestsellers";
}) {
  const customers = mode === "customers";
  const [start, setStart] = useState(() =>
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
  );
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const validRange =
    !!start &&
    !!end &&
    start <= end &&
    +new Date(end) - +new Date(start) <= 365 * 86400000;
  const query = useQuery<SalesData | CustomerData>({
    queryKey: ["report", mode, start, end, search],
    enabled: validRange,
    queryFn: async () =>
      (
        await api.get(`/reports/${customers ? "customers" : "sales"}`, {
          params: { startDate: start, endDate: end, search },
        })
      ).data.data,
  });
  const sales = !customers ? (query.data as SalesData | undefined) : undefined;
  const people = customers
    ? (query.data as CustomerData | undefined)
    : undefined;
  const rows: (string | number)[][] = customers
    ? [
        ["Khách hàng", "Email", "Đơn đã thanh toán", "Tiền đã thu"],
        ...(people?.customers || []).map((c) => [
          [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username,
          c.email,
          c.orders,
          c.spent,
        ]),
      ]
    : [
        ["Sản phẩm", "Số lượng đã bán", "Giá trị sản phẩm trước ưu đãi đơn"],
        ...(sales?.topProducts || []).map((p) => [
          p.name || p._id,
          p.quantity,
          p.revenue,
        ]),
      ];
  return (
    <div className="report-page">
      <div className="section-heading">
        <h1>
          {customers
            ? "Báo cáo khách hàng"
            : mode === "sales"
            ? "Báo cáo doanh thu"
            : "Sản phẩm bán chạy"}
        </h1>
        <div className="order-actions">
          <button
            className="icon-button"
            title="Xuất CSV"
            aria-label="Xuất CSV"
            disabled={!query.data}
            onClick={() => downloadCsv(`${mode}-${start}-${end}.csv`, rows)}
          >
            <Download size={20} />
          </button>
          <button
            className="icon-button"
            title="In báo cáo"
            aria-label="In báo cáo"
            onClick={() => window.print()}
          >
            <Printer size={20} />
          </button>
        </div>
      </div>
      <div className="report-toolbar">
        <label>
          Từ ngày
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        {customers && (
          <input
            aria-label="Tìm khách hàng"
            placeholder="Tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>
      {!validRange ? (
        <p className="error-banner">
          Chọn khoảng thời gian hợp lệ, tối đa một năm.
        </p>
      ) : query.isLoading || query.isError ? (
        <RequestState
          loading={query.isLoading}
          error={query.isError}
          retry={() => query.refetch()}
        />
      ) : (
        <>
          <div className="report-stats">
            {(customers
              ? [
                  ["Tổng khách hàng", people?.summary.total || 0],
                  ["Khách mới trong kỳ", people?.summary.newCustomers || 0],
                  ["Email đã xác thực", people?.summary.verified || 0],
                ]
              : [
                  ["Tiền đã thu", money(sales?.summary.revenue || 0)],
                  ["Đơn hàng hợp lệ", sales?.summary.orders || 0],
                  ["Giá trị đơn hàng", money(sales?.summary.orderValue || 0)],
                  ["Chưa thanh toán", money(sales?.summary.unpaid || 0)],
                ]
            ).map(([label, value]) => (
              <div key={String(label)}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {mode !== "bestsellers" &&
            (query.data?.daily.length ? (
              <div className="report-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={query.data.daily}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e3e8df"
                    />
                    <XAxis
                      dataKey="_id"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={65}
                      tickFormatter={(v) =>
                        customers ? v : `${Math.round(v / 1000)}k`
                      }
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        customers ? value : money(value)
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey={customers ? "count" : "revenue"}
                      name={customers ? "Khách mới" : "Tiền đã thu"}
                      stroke="#3b7553"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <RequestState empty="Chưa có giao dịch trong khoảng thời gian này." />
            ))}
          <h2 style={{ fontSize: 18, marginBottom: 18 }}>
            {customers
              ? "Khách hàng theo số tiền đã thanh toán"
              : "Sản phẩm trong đơn đã thanh toán"}
          </h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {rows[0].map((cell) => (
                    <th key={cell}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, index) => (
                      <td key={index}>
                        {index === row.length - 1 ? money(Number(cell)) : cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 1 && (
                  <tr>
                    <td colSpan={rows[0].length}>Chưa có dữ liệu</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
