import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCart } from "../../cart/context/cart-hook";
import { useAuth } from "../../auth/hooks/auth-hook";
import {
  defaultSettings,
  useStoreSettings,
} from "../../store/useStoreSettings";
import orderService from "../services/order-service";
import type { ShippingForm, VoucherResult } from "../interface/interface";

export const useCheckout = () => {
  const navigate = useNavigate();
  const { state } = useAuth();
  const cart = useCart();
  const settingsQuery = useStoreSettings();
  const settings = settingsQuery.data || defaultSettings;
  const { items, subtotal, refreshCart, isSyncing, syncError } = cart;
  const [form, setForm] = useState<ShippingForm>(() => ({
    firstName: state.user?.firstName || "",
    lastName: state.user?.lastName || "",
    email: state.user?.email || "",
    phone: state.user?.phoneNumber || "",
    address: "",
    apartment: "",
    city: "",
    province: "",
    zipCode: "",
    country: "Việt Nam",
    saveInfo: false,
    shippingMethod: "standard",
    paymentMethod: "cod",
    discountCode: "",
  }));
  const [voucher, setVoucher] = useState<VoucherResult | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const key = useRef<{ payload: string; value: string } | null>(null);
  const voucherFingerprint = useRef("");
  const fingerprint = JSON.stringify(
    items.map((item) => [item.id, item.quantity, item.price])
  );
  const currentVoucher =
    voucherFingerprint.current === fingerprint ? voucher : null;
  const shippingFee =
    subtotal >= settings.freeShippingThreshold
      ? 0
      : form.shippingMethod === "express"
      ? settings.expressShipping
      : settings.standardShipping;
  const discount = Math.min(subtotal, currentVoucher?.discountAmount || 0);
  const total = Math.max(0, subtotal + shippingFee - discount);
  const bankAvailable = !!(
    settings.bankName &&
    settings.bankAccount &&
    settings.bankAccountName
  );
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    if (name === "discountCode") setVoucher(null);
    setForm((previous) => ({ ...previous, [name]: value }));
  };
  const handleApplyVoucher = async () => {
    if (!form.discountCode.trim() || isSyncing) return;
    setApplyingVoucher(true);
    try {
      const result = await orderService.applyVoucher(form.discountCode.trim());
      voucherFingerprint.current = fingerprint;
      setVoucher(result);
      toast.success("Đã áp dụng mã ưu đãi.");
    } catch {
      setVoucher(null);
      toast.error("Mã ưu đãi không hợp lệ hoặc đã hết lượt sử dụng.");
    } finally {
      setApplyingVoucher(false);
    }
  };
  const orderMutation = useMutation({
    mutationFn: (payload: Parameters<typeof orderService.createOrder>[0]) => {
      const serialized = JSON.stringify(payload) + fingerprint;
      if (!key.current || key.current.payload !== serialized)
        key.current = { payload: serialized, value: crypto.randomUUID() };
      return orderService.createOrder(payload, key.current.value);
    },
    onSuccess: async (order) => {
      key.current = null;
      await refreshCart();
      toast.success("Đã tiếp nhận đơn hàng.");
      navigate(`/shop/account/orders/${order._id}?placed=1`);
    },
    onError: (error: any) =>
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error?.message ||
          "Không thể đặt hàng. Vui lòng thử lại."
      ),
  });
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      orderMutation.isLoading ||
      isSyncing ||
      syncError ||
      settingsQuery.isError ||
      settingsQuery.isLoading
    )
      return;
    if (!items.length) {
      toast.error("Giỏ hàng trống.");
      return;
    }
    if (!/^[+\d][\d\s().-]{8,19}$/.test(form.phone)) {
      toast.error("Số điện thoại không hợp lệ.");
      return;
    }
    orderMutation.mutate({
      shippingAddress: {
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        address: [form.address, form.apartment].filter(Boolean).join(", "),
        city: form.city,
        state: form.province,
        postalCode: form.zipCode,
        country: form.country,
        phone: form.phone,
      },
      paymentMethod: form.paymentMethod,
      shippingMethod: form.shippingMethod,
      ...(currentVoucher ? { voucherId: currentVoucher.voucherId } : {}),
    });
  };
  return {
    items,
    subtotal,
    form,
    voucher: currentVoucher,
    shippingFee,
    discount,
    total,
    applyingVoucher,
    isSubmitting: orderMutation.isLoading,
    isSyncing,
    syncError,
    settings,
    bankAvailable,
    settingsLoading: settingsQuery.isLoading,
    settingsError: settingsQuery.isError,
    retrySettings: settingsQuery.refetch,
    handleChange,
    handleApplyVoucher,
    handleSubmitOrder,
  };
};
