import { PackageOpen, RefreshCw } from "lucide-react";

export default function RequestState({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: boolean;
  empty?: string;
  retry?: () => void;
}) {
  if (loading)
    return (
      <div className="request-state" role="status">
        <RefreshCw className="animate-spin" size={24} />
        <p>Đang tải...</p>
      </div>
    );
  return (
    <div className="request-state" role={error ? "alert" : "status"}>
      <PackageOpen size={36} strokeWidth={1.3} />
      <p>
        {error
          ? "Không thể tải dữ liệu. Vui lòng thử lại."
          : empty || "Chưa có dữ liệu."}
      </p>
      {error && retry && (
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={16} />
          Thử lại
        </button>
      )}
    </div>
  );
}
