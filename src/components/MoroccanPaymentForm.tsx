import React, { useState, useEffect } from 'react';
import { MoroccanBankAccount } from '../types/user';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_MOROCCAN_BANK_ACCOUNTS,
  filterActiveBankAccounts,
  inferMoroccanPaymentMethod,
} from '../utils/currencyAndBanks';
import {
  Building2,
  Copy,
  Check,
  Send,
  FileCheck2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

export const MoroccanPaymentForm: React.FC<Props> = ({ onSuccess }) => {
  const { submitManualPayment } = useAuth();
  const [banks, setBanks] = useState<MoroccanBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadBanks = async () => {
      try {
        const res = await fetch('/api/settings/banks');
        if (!res.ok) {
          throw new Error('Failed to fetch banks');
        }
        const data = (await res.json()) as { banks?: MoroccanBankAccount[] };
        if (isMounted && Array.isArray(data?.banks)) {
          const active = filterActiveBankAccounts(data.banks);
          setBanks(active);
          setSelectedBankId((prev) =>
            active.some((b) => b.id === prev) ? prev : active[0]?.id || ''
          );
        }
      } catch (_err) {
        // Only use DEFAULT_MOROCCAN_BANK_ACCOUNTS if the API call fails AND no cached data exists
        if (isMounted) {
          setBanks((prev) => {
            if (prev.length > 0) return prev;
            const fallback = filterActiveBankAccounts(DEFAULT_MOROCCAN_BANK_ACCOUNTS);
            setSelectedBankId(fallback[0]?.id || '');
            return fallback;
          });
        }
      }
    };
    loadBanks();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentAccount: MoroccanBankAccount | undefined =
    banks.find((m) => m.id === selectedBankId) || banks[0];

  if (banks.length === 0 || !currentAccount) {
    return (
      <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 text-center space-y-2 text-gray-200" dir="rtl">
        <Building2 className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-xs font-bold text-white">
          لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.
        </p>
      </div>
    );
  }

  const currentDetails = {
    id: currentAccount.id,
    name: currentAccount.name,
    badge: currentAccount.badge || currentAccount.subtitle,
    rib: currentAccount.rib,
    titulaire: currentAccount.beneficiary,
    cin: currentAccount.cin,
    phone: currentAccount.phone,
    instructions: currentAccount.instructions,
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) {
      setError('Veuillez renseigner le numéro de transaction ou code du virement.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const resolvedMethod = inferMoroccanPaymentMethod(currentAccount);
    const res = await submitManualPayment(
      resolvedMethod,
      reference,
      100, // 100 MAD
      undefined,
      notes ? `${currentAccount.name} - ${notes}` : currentAccount.name
    );

    setSubmitting(false);

    if (res.success) {
      setSuccess(
        'Reçu de paiement transmis avec succès ! Notre équipe marocaine va valider votre transaction et activer votre abonnement Pro.'
      );
      setReference('');
      setNotes('');
      if (onSuccess) {
        setTimeout(onSuccess, 2500);
      }
    } else {
      setError(res.error || 'Erreur lors de la soumission du paiement.');
    }
  };

  return (
    <div className="space-y-5 text-gray-200">
      {/* Method Switcher Chips */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
          1. Choisissez votre méthode de paiement préférée :
        </label>
        <div className="grid grid-cols-2 gap-2">
          {banks.map((m) => {
            const isSelected = currentAccount.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedBankId(m.id)}
                className={`p-3 rounded-2xl border text-start transition flex items-start gap-2.5 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                    : 'border-gray-800 bg-gray-900/80 hover:border-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-white">{m.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{m.badge}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Instructions Card */}
      <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="font-black text-xs text-white">{currentDetails.name}</span>
          </div>
          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            100 DH / mois
          </span>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">{currentDetails.instructions}</p>

        {/* Bank Details / Account Info */}
        <div className="space-y-2 pt-1 text-xs font-mono">
          {currentDetails.rib && (
            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] text-gray-500 font-sans font-bold">RIB / Compte Bancaire (24 chiffres)</span>
                <span className="text-emerald-300 font-bold tracking-wider">{currentDetails.rib}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentDetails.rib!, 'rib')}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition shrink-0"
                title="Copier le RIB"
              >
                {copiedKey === 'rib' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {currentDetails.titulaire && (
            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] text-gray-500 font-sans font-bold">Bénéficiaire / Titulaire</span>
                <span className="text-white font-bold font-sans">{currentDetails.titulaire}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentDetails.titulaire!, 'titulaire')}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition shrink-0"
                title="Copier le nom"
              >
                {copiedKey === 'titulaire' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {currentDetails.cin && (
            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] text-gray-500 font-sans font-bold">CIN du Destinataire</span>
                <span className="text-amber-300 font-bold">{currentDetails.cin}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentDetails.cin!, 'cin')}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition shrink-0"
              >
                {copiedKey === 'cin' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Submission Confirmation Form */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
          2. Confirmez votre transfert :
        </label>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-900/30 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-300 mb-1">
            Numéro de transaction / Référence du virement *
          </label>
          <input
            type="text"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ex: CIH-VIR-940219 ou Code de retrait Cash Plus"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-300 mb-1">
            Remarques ou Nom de l'expéditeur (optionnel)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Virement effectué depuis le compte de Yassine"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{submitting ? 'Transmission en cours...' : 'Soumettre le Reçu pour Validation (100 DH)'}</span>
        </button>

        <p className="text-center text-[11px] text-gray-500 flex items-center justify-center gap-1 pt-1">
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>Vérification manuelle rapide par nos agents au Maroc (généralement en moins de 2 heures).</span>
        </p>
      </form>
    </div>
  );
};
