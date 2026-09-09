import { useState } from "react";
import { Bot, Cpu, Database, ExternalLink, MessageSquare, Settings, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import AIChatPanel from "./AIChatPanel";
import AISettingsPanel from "./AISettingsPanel";
import AIModelPanel from "./AIModelPanel";
import AIIntentPanel from "./AIIntentPanel";
import AIExamplesPanel from "./AIExamplesPanel";
import AIConversationsPanel from "./AIConversationsPanel";
import "../../ai.css";

const tabs = [
  { id: "model", label: "Model & huấn luyện", icon: Cpu },
  { id: "examples", label: "Câu mẫu", icon: Database },
  { id: "intents", label: "Intent", icon: Tag },
  { id: "conversations", label: "Hội thoại", icon: MessageSquare },
  { id: "chat", label: "Chat thử", icon: Bot },
  { id: "settings", label: "Cài đặt", icon: Settings },
] as const;
export default function AIAssistantManagement() {
  const [active, setActive] = useState<string>("model");
  return <div className="ai-management"><header className="ai-page-heading"><div><span className="ai-eyebrow">KITCHEN E</span><h1>Trợ lý AI</h1></div><Link className="button secondary" to="/shop/assistant"><ExternalLink size={16} /> Trợ lý trên cửa hàng</Link></header>
    <nav className="ai-tabs" aria-label="Quản lý trợ lý">{tabs.map(({ id, label, icon: Icon }) => <button key={id} aria-current={active === id ? "page" : undefined} onClick={() => setActive(id)}><Icon size={17} />{label}</button>)}</nav>
    {active === "model" && <AIModelPanel />}{active === "examples" && <AIExamplesPanel />}{active === "intents" && <AIIntentPanel />}{active === "conversations" && <AIConversationsPanel />}{active === "chat" && <AIChatPanel />}{active === "settings" && <AISettingsPanel />}
  </div>;
}
