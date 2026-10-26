import React from 'react';
import { BundleOption } from '../types/landingPage';
import { CheckCircle2, X, Printer, PhoneCall, Truck } from 'lucide-react';

export interface OrderConfirmationData {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  customerNote?: string;
  bundle: BundleOption;
  totalPrice: number;
  currency: string;
  turnstileToken?: string;
}

interface Props {
  orderData: OrderConfirmationData | null;
  onClose: () => void;
  isRtl?: boolean;
}

export const OrderSuccessModal: React.FC<Props> = ({ orderData, onClose, isRtl }) => {
  if (!orderData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative border border-gray-100 overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-2 uppercase tracking-wider">
            {isRtl ? 'تم تأكيد طلبك بنجاح' : 'Order Successfully Placed • Cash on Delivery'}
          </span>

          <h3 className="text-2xl font-black text-gray-900 mb-1">
            {isRtl ? 'شكراً لثقتكم واختياركم لنا!' : 'Thank You for Your Order!'}
          </h3>

          <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
            {isRtl
              ? 'سيتواصل معك مندوبنا هاتفياً خلال الدقائق القادمة لتأكيد موعد التسليم والشحن فوراً.'
              : 'Our confirmation agent will call you shortly to confirm your delivery address and dispatch.'}
          </p>
        </div>

        {/* Receipt Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs space-y-2.5 mb-6">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <span className="text-gray-500 font-medium">{isRtl ? 'رقم الطلب:' : 'Order ID:'}</span>
            <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
              {orderData.orderId}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">{isRtl ? 'الاسم:' : 'Recipient:'}</span>
            <span className="font-semibold text-gray-900">{orderData.customerName}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">{isRtl ? 'الهاتف:' : 'Phone:'}</span>
            <span className="font-mono font-semibold text-gray-900">{orderData.customerPhone}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">{isRtl ? 'المدينة والعنوان:' : 'City & Address:'}</span>
            <span className="font-semibold text-gray-900 text-end max-w-[200px] truncate">
              {orderData.customerCity}, {orderData.customerAddress}
            </span>
          </div>

          <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-sm">
            <span>{isRtl ? 'المبلغ المطلوب نقداً عند الاستلام:' : 'Total (Pay on Delivery):'}</span>
            <span className="text-emerald-600 font-black">
              {orderData.totalPrice} {orderData.currency}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-3 px-4 border border-gray-300 hover:bg-gray-50 rounded-xl font-bold text-xs text-gray-700 flex items-center justify-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>{isRtl ? 'طباعة الوصل' : 'Print Receipt'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg"
          >
            <span>{isRtl ? 'إتمام ومتابعة' : 'Done • Continue'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
