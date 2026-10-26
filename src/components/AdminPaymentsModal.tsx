import React, { useState, useEffect } from 'react';
import { ManualPaymentRequest } from '../types/user';
import { useAuth } from '../context/AuthContext';
import {
  X,
  ShieldCheck,
  Check,
  Ban,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Building2,
  AlertCircle,
  FileText,
  UserCheck,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPaymentsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { fetchAdminPayments, approveAdminPayment, rejectAdminPayment, user } = useAuth();
  const [payments, setPayments] = useState<ManualPaymentRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAdminPayments();
    setPayments(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    const res = await approveAdminPayment(id);
    setActionLoadingId(null);
    if (res.success) {
      setToastMessage(res.message || 'Payment approved and Pro plan activated!');
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'approved' } : p))
      );
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    const res = await rejectAdminPayment(id);
    setActionLoadingId(null);
    if (res.success) {
      setToastMessage(res.message || 'Payment marked as rejected.');
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'rejected' } : p))
      );
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  const filteredPayments = payments.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'CIH':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Attijariwafa':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CashPlus':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Wafacash':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900">
                  🇲🇦 Moroccan Payments Verification Hub
                </h3>
                {pendingCount > 0 && (
                  <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Review offline bank transfers & money agency receipts to activate Pro plans.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-200/80 transition"
              title="Refresh payments"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-2.5 px-4 text-center transition flex items-center justify-center gap-1.5 shadow-inner">
            <UserCheck className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 px-5 pt-3 gap-2 bg-white">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition ${
              filter === 'all'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            All Submissions ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              filter === 'pending'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending Review ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('approved')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition ${
              filter === 'approved'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Approved ({payments.filter((p) => p.status === 'approved').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('rejected')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition ${
              filter === 'rejected'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Rejected ({payments.filter((p) => p.status === 'rejected').length})
          </button>
        </div>

        {/* Payments List Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3.5 bg-gray-50/50">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold">No payment submissions found in this category.</p>
            </div>
          ) : (
            filteredPayments.map((p) => {
              const isPending = p.status === 'pending';
              const isApproved = p.status === 'approved';
              const isRejected = p.status === 'rejected';

              return (
                <div
                  key={p.id}
                  className={`bg-white border rounded-2xl p-4 md:p-5 shadow-xs transition space-y-3 ${
                    isPending
                      ? 'border-amber-300 ring-1 ring-amber-400/20'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-lg border ${getMethodBadgeColor(
                          p.method
                        )}`}
                      >
                        {p.method}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-gray-900">{p.userName}</h4>
                        <span className="text-[11px] text-gray-500">{p.userEmail}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {p.amount} MAD (~$10)
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : isRejected
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-gray-400 text-[10px] font-bold uppercase">
                        Transaction Reference / Code:
                      </span>
                      <div className="flex items-center gap-2 font-mono font-bold text-gray-800 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <span className="truncate">{p.transactionReference}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(p.transactionReference)}
                          className="ms-auto p-1 hover:bg-gray-200 rounded text-gray-500 transition"
                          title="Copy Code"
                        >
                          {copiedRef === p.transactionReference ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-gray-400 text-[10px] font-bold uppercase">
                        Submitted On:
                      </span>
                      <div className="text-gray-700 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Remarks or Notes */}
                  {p.notes && (
                    <div className="text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 italic">
                      "{p.notes}"
                    </div>
                  )}

                  {/* Proof Image Preview */}
                  {p.proofImageUrl && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={p.proofImageUrl}
                        alt="Receipt Proof"
                        className="w-14 h-14 object-cover rounded-xl border border-gray-300 shadow-xs cursor-pointer hover:scale-105 transition"
                        onClick={() => window.open(p.proofImageUrl, '_blank')}
                      />
                      <span className="text-[11px] text-gray-500">
                        Click receipt image to view full size
                      </span>
                    </div>
                  )}

                  {/* Action Buttons for Pending Payments */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        disabled={actionLoadingId === p.id}
                        onClick={() => handleReject(p.id)}
                        className="py-2 px-3.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoadingId === p.id}
                        onClick={() => handleApprove(p.id)}
                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>
                          {actionLoadingId === p.id ? 'Activating Pro...' : 'Approve & Activate Pro (100 DH)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
