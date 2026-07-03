import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useCart } from '../../cart/context/cart-context';
import orderService from '../services/order-service';
import type { ShippingForm, VoucherResult } from '../interface/interface';

const DEFAULT_FORM: ShippingForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  apartment: '',
  city: '',
  province: '',
  zipCode: '',
  country: 'Việt Nam',
  saveInfo: true,
  shippingMethod: 'standard',
  paymentMethod: 'cod',
  discountCode: '',
};

export const useCheckout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();

  const [form, setForm] = useState<ShippingForm>(DEFAULT_FORM);
  const [voucher, setVoucher] = useState<VoucherResult | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const shippingFee = form.shippingMethod === 'express' ? 150000 : 0;
  const discount = voucher?.discountAmount ?? 0;
  const total = subtotal + shippingFee - discount;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleApplyVoucher = async () => {
    if (!form.discountCode.trim()) return;
    setApplyingVoucher(true);
    try {
      const result = await orderService.applyVoucher(form.discountCode.trim(), subtotal);
      setVoucher(result);
      toast.success(`Áp dụng mã giảm giá thành công: -${result.discountAmount.toLocaleString()}₫`);
    } catch {
      toast.error('Mã giảm giá không hợp lệ hoặc không áp dụng được.');
      setVoucher(null);
    } finally {
      setApplyingVoucher(false);
    }
  };

  const orderMutation = useMutation({
    mutationFn: (payload: Parameters<typeof orderService.createOrder>[0]) =>
      orderService.createOrder(payload),
    onSuccess: () => {
      clearCart();
      toast.success('Đặt hàng thành công!');
      navigate('/shop/account/orders');
    },
    onError: () => {
      toast.error('Không thể đặt hàng. Vui lòng thử lại.');
    },
  });

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Giỏ hàng trống.');
      return;
    }

    orderMutation.mutate({
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.price,
      })),
      shippingAddress: {
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        street: [form.address, form.apartment].filter(Boolean).join(', '),
        city: form.city,
        province: form.province,
        zipCode: form.zipCode,
        country: form.country,
        phone: form.phone,
      },
      paymentMethod: form.paymentMethod,
      shippingMethod: form.shippingMethod,
      shippingFee,
      ...(voucher && { voucherCode: voucher.voucherCode, discountAmount: voucher.discountAmount }),
      totalAmount: total,
      customerEmail: form.email,
    });
  };

  return {
    items,
    subtotal,
    form,
    voucher,
    shippingFee,
    discount,
    total,
    applyingVoucher,
    isSubmitting: orderMutation.isLoading,
    handleChange,
    handleApplyVoucher,
    handleSubmitOrder,
  };
};
