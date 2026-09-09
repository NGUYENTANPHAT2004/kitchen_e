import { useEffect, useRef, useState } from "react";
import { Bot, Maximize2, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AIChatPanel from "../dashboard/AIChatPanel";

export default function AssistantWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  const close = () => { setOpen(false); launchButton.current?.focus(); };
  if (location.pathname === "/shop/assistant") return null;
  return <div className="ai-widget" onKeyDown={e => { if (e.key === "Escape") close(); }}>
    {open && <section className="ai-widget-window" role="dialog" aria-label="Trò chuyện với Kitchen E"><div className="ai-widget-toolbar"><span>Kitchen E</span><div className="ai-actions"><Link className="icon-button" to="/shop/assistant" title="Mở trang trợ lý" aria-label="Mở trang trợ lý"><Maximize2 size={17} /></Link><button ref={closeButton} className="icon-button" aria-label="Đóng trợ lý" title="Đóng" onClick={close}><X size={20} /></button></div></div><AIChatPanel compact /></section>}
    <button ref={launchButton} className="ai-widget-launch" aria-label={open ? "Thu gọn trợ lý" : "Chat với trợ lý Kitchen E"} title="Trợ lý Kitchen E" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>{open ? <X size={24} /> : <Bot size={25} />}<span>Trợ lý Kitchen E</span></button>
  </div>;
}
