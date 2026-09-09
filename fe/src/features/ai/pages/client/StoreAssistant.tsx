import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ClientLayout from "../../../../components/layout/client/ClientLayout";
import AIChatPanel from "../dashboard/AIChatPanel";

export default function StoreAssistant() {
  return <ClientLayout><div className="store-container ai-store-page"><Link className="text-link" to="/shop/home"><ArrowLeft size={16} /> Cửa hàng</Link><div className="ai-store-heading"><h1>Trợ lý căn bếp</h1><p>Tìm dụng cụ phù hợp. Thêm cảm hứng vào bếp.</p></div><AIChatPanel /></div></ClientLayout>;
}
