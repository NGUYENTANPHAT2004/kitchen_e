import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../../config/api_cli.config";

export default function NotificationComposer() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [ids, setIds] = useState("");
  const navigate = useNavigate();
  const recipients = [...new Set(ids.split(/[\s,]+/).filter(Boolean))];
  const mutation = useMutation({
    mutationFn: () =>
      api.post("/notifications/bulk", {
        userIds: recipients,
        type: "system",
        title: title.trim(),
        message: message.trim(),
        channels: { inApp: true, email: false, push: false, sms: false },
      }),
    onSuccess: () => {
      toast.success("Đã gửi thông báo.");
      navigate("/notifications");
    },
    onError: () => toast.error("Không thể gửi thông báo."),
  });
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          !recipients.length ||
          recipients.length > 100 ||
          !recipients.every((id) => /^[a-f\d]{24}$/i.test(id))
        ) {
          toast.error("Cần từ 1 đến 100 mã người dùng hợp lệ.");
          return;
        }
        if (!title.trim() || !message.trim()) {
          toast.error("Vui lòng nhập đầy đủ nội dung.");
          return;
        }
        if (
          confirm(`Gửi thông báo đến ${recipients.length} người dùng đã chọn?`)
        )
          mutation.mutate();
      }}
    >
      <Link className="text-link" to="/notifications">
        <ArrowLeft size={15} />
        Thông báo
      </Link>
      <div className="section-heading" style={{ marginTop: 24 }}>
        <h1>Gửi thông báo</h1>
        <button className="button" disabled={mutation.isLoading}>
          <Send size={16} />
          Gửi thông báo
        </button>
      </div>
      <div className="form-grid">
        <label className="field full">
          Mã người nhận
          <textarea
            required
            value={ids}
            onChange={(e) => setIds(e.target.value)}
          />
        </label>
        <label className="field full">
          Tiêu đề
          <input
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field full">
          Nội dung
          <textarea
            required
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
      </div>
    </form>
  );
}
