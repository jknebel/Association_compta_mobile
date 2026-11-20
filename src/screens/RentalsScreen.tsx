import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  Trash2,
  Calendar,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Rental, NewRentalInput, RentalStatus } from '../types/rental';
import {
  RENTAL_ROOMS,
  validateRentalInput,
  subscribeRentals,
  createRental,
  markRentalAsPaid,
  updateRentalStatus,
  deleteRental,
} from '../services/rentalService';

export const RentalsScreen: React.FC = () => {
  const { userProfile, selectedCompta, authorizedComptas } = useAuth();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPayingRental, setIsPayingRental] = useState<Rental | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Virement' | 'Cash' | 'TWINT'>('Virement');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState<NewRentalInput>({
    roomName: RENTAL_ROOMS[0],
    renterName: '',
    renterPhone: '',
    renterEmail: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    amount: 150,
    notes: '',
  });

  // Les locations sont propres à la comptabilité de Groupe uniquement
  const groupeCompta =
    authorizedComptas.find((c) => c.role === 'responsable_location') ||
    authorizedComptas.find((c) => c.comptaName.toLowerCase().includes('groupe')) ||
    selectedCompta ||
    authorizedComptas[0] ||
    null;

  const orgId = groupeCompta?.orgId || userProfile?.orgId || 'TDGL';
  const comptaId = groupeCompta?.comptaId || 'default';

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeRentals(
      orgId,
      comptaId,
      (list) => {
        setRentals(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erreur souscription locations :', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, comptaId]);

  // Statistiques calculées
  const stats = useMemo(() => {
    let pendingAmount = 0;
    let pendingCount = 0;
    let paidAmount = 0;
    let paidCount = 0;

    for (const r of rentals) {
      if (r.status === 'PENDING') {
        pendingAmount += r.amount;
        pendingCount++;
      } else if (r.status === 'PAID') {
        paidAmount += r.amount;
        paidCount++;
      }
    }

    return { pendingAmount, pendingCount, paidAmount, paidCount };
  }, [rentals]);

  // Filtrage
  const filteredRentals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rentals.filter((r) => {
      if (filterStatus === 'PENDING' && r.status !== 'PENDING') return false;
      if (filterStatus === 'PAID' && r.status !== 'PAID') return false;
      if (!q) return true;
      return (
        r.renterName.toLowerCase().includes(q) ||
        r.roomName.toLowerCase().includes(q) ||
        (r.renterPhone && r.renterPhone.toLowerCase().includes(q)) ||
        (r.renterEmail && r.renterEmail.toLowerCase().includes(q))
      );
    });
  }, [rentals, filterStatus, searchQuery]);

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const validationResult = validateRentalInput(formData);
    if (!validationResult.valid) {
      alert(validationResult.error || 'Veuillez vérifier les informations de la location.');
      return;
    }

    setSubmitting(true);
    try {
      await createRental(orgId, comptaId, formData, userProfile);
      setIsModalOpen(false);
      // Réinitialiser le formulaire
      setFormData({
        roomName: RENTAL_ROOMS[0],
        renterName: '',
        renterPhone: '',
        renterEmail: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        amount: 150,
        notes: '',
      });
    } catch (err) {
      console.error('Erreur création location :', err);
      alert('Erreur lors de l’enregistrement de la location : ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!isPayingRental || !userProfile) return;
    setSubmitting(true);
    try {
      await markRentalAsPaid(orgId, comptaId, isPayingRental.id, paymentMethod, userProfile);
      setIsPayingRental(null);
    } catch (err) {
      console.error('Erreur validation paiement :', err);
      alert('Erreur lors de la validation du paiement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rental: Rental) => {
    if (
      !confirm(
        `Supprimer la location de ${rental.renterName} (${rental.roomName} - CHF ${rental.amount.toFixed(2)}) ?`
      )
    ) {
      return;
    }
    try {
      await deleteRental(orgId, comptaId, rental.id);
    } catch (err) {
      console.error('Erreur suppression :', err);
      alert('Erreur lors de la suppression.');
    }
  };

  const handleToggleStatus = async (rental: Rental) => {
    if (!userProfile) return;
    const nextStatus: RentalStatus = rental.status === 'PAID' ? 'PENDING' : 'PAID';
    if (nextStatus === 'PAID') {
      setIsPayingRental(rental);
    } else {
      if (confirm(`Remettre la location de ${rental.renterName} en attente de paiement ?`)) {
        await updateRentalStatus(orgId, comptaId, rental.id, 'PENDING', userProfile);
      }
    }
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-lg mx-auto">
      {/* Entête du module */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Building2 size={20} />
            </span>
            <h1 className="text-lg font-bold text-slate-100">Locations de locaux</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {groupeCompta?.comptaName || 'Comptabilité de Groupe — Réservations & encaissements'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium text-xs py-2 px-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus size={16} />
          <span>Nouvelle</span>
        </button>
      </div>

      {/* Cartes de synthèse financière */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* À encaisser */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">À encaisser</span>
            <Clock size={16} />
          </div>
          <div className="text-xl font-black text-amber-300">
            CHF {stats.pendingAmount.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.pendingCount} {stats.pendingCount > 1 ? 'locations en attente' : 'location en attente'}
          </div>
        </div>

        {/* Déjà encaissé */}
        <div className="bg-slate-900/90 border border-emerald-500/20 rounded-2xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Déjà encaissé</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-xl font-black text-emerald-300">
            CHF {stats.paidAmount.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.paidCount} {stats.paidCount > 1 ? 'locations réglées' : 'location réglée'}
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un locataire, local ou tél…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
              filterStatus === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Toutes ({rentals.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('PENDING')}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
              filterStatus === 'PENDING'
                ? 'bg-amber-500/20 text-amber-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            À payer ({stats.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('PAID')}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
              filterStatus === 'PAID'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Payées ({stats.paidCount})
          </button>
        </div>
      </div>

      {/* Liste des locations */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
          <p className="text-xs">Chargement des locations…</p>
        </div>
      ) : filteredRentals.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center">
          <Building2 size={36} className="mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">Aucune location trouvée</p>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery
              ? 'Aucun résultat ne correspond à votre recherche.'
              : 'Cliquez sur « Nouvelle » pour enregistrer votre première location.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRentals.map((r) => {
            const isPaid = r.status === 'PAID';

            return (
              <div
                key={r.id}
                className={`bg-slate-900 border rounded-2xl p-4 transition-all relative ${
                  isPaid
                    ? 'border-emerald-500/20 bg-slate-900/80'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* En-tête de la carte : Local & Statut */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {r.roomName}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isPaid ? (
                        <>
                          <CheckCircle2 size={11} /> Payé
                        </>
                      ) : (
                        <>
                          <Clock size={11} /> À encaisser
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-base font-extrabold ${
                        isPaid ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      CHF {r.amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Nom du locataire */}
                <h3 className="text-sm font-bold text-slate-100">{r.renterName}</h3>

                {/* Dates & Remarques */}
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <Calendar size={13} className="text-slate-500 shrink-0" />
                  <span>
                    {r.startDate}
                    {r.endDate && r.endDate !== r.startDate ? ` au ${r.endDate}` : ''}
                  </span>
                </div>

                {r.notes && (
                  <p className="text-xs text-slate-400 bg-slate-950/60 rounded-lg p-2 mt-2 border border-slate-800/60 italic">
                    « {r.notes} »
                  </p>
                )}

                {/* Traçabilité du paiement (si payé) */}
                {isPaid && (
                  <div className="mt-2 text-[11px] text-emerald-400/90 bg-emerald-950/30 border border-emerald-900/40 rounded-lg p-2 flex items-center gap-2">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                    <span>
                      Règlement {r.paidByMethod ? `par ${r.paidByMethod}` : ''}{' '}
                      {r.paidMarkedByName ? `• Validé par ${r.paidMarkedByName}` : ''}
                    </span>
                  </div>
                )}

                {/* Barre d'actions rapides smartphone */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {r.renterPhone && (
                      <>
                        <a
                          href={`tel:${r.renterPhone}`}
                          className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Phone size={12} className="text-emerald-400" />
                          <span>Appeler</span>
                        </a>
                        <a
                          href={`sms:${r.renterPhone}`}
                          className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <MessageSquare size={12} className="text-sky-400" />
                          <span>SMS</span>
                        </a>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Bascule Payé / À payer */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(r)}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                        isPaid
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span>{isPaid ? 'Annuler paiement' : 'Encaissé'}</span>
                    </button>

                    {/* Supprimer */}
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Supprimer la location"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Dialog : Nouvelle location */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Building2 size={18} />
                </span>
                <h2 className="text-base font-bold text-slate-100">Nouvelle location</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRental} className="space-y-3.5">
              {/* Choix du local (uniquement 2 locaux : avec ou sans cuisine) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Local loué *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RENTAL_ROOMS.map((room) => {
                    const isSelected = formData.roomName === room;
                    return (
                      <button
                        type="button"
                        key={room}
                        onClick={() => setFormData({ ...formData, roomName: room })}
                        className={`py-2.5 px-3 text-xs rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200 font-semibold shadow-sm shadow-indigo-500/10'
                            : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span>{room}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nom du locataire */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Locataire (Nom & Prénom / Association) *
                </label>
                <input
                  type="text"
                  placeholder="Ex : Famille Dupont, Club des Aînés…"
                  value={formData.renterName}
                  onChange={(e) => setFormData({ ...formData, renterName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Téléphone & E-mail */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    placeholder="079 123 45 67"
                    value={formData.renterPhone}
                    onChange={(e) => setFormData({ ...formData, renterPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="locataire@exemple.ch"
                    value={formData.renterEmail}
                    onChange={(e) => setFormData({ ...formData, renterEmail: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Dates & Tarif */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tarif convenu (CHF) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="150.00"
                    value={formData.amount || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Remarques */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Remarques (clés, caution, horaires…)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex : Caution de 100.- déposée en cash, clés rendues dimanche à 18h."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition-all"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation du paiement */}
      {isPayingRental && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={18} />
                </span>
                <h3 className="text-sm font-bold text-slate-100">Valider l’encaissement</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPayingRental(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 mb-4 text-center">
              <p className="text-xs text-slate-400">{isPayingRental.renterName}</p>
              <p className="text-xs text-slate-500">{isPayingRental.roomName}</p>
              <p className="text-xl font-black text-emerald-400 mt-1">
                CHF {isPayingRental.amount.toFixed(2)}
              </p>
            </div>

            <p className="text-xs text-slate-300 font-semibold mb-2">Mode de règlement :</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('Virement')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs gap-1 transition-all ${
                  paymentMethod === 'Virement'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard size={18} />
                <span>Virement</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TWINT')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs gap-1 transition-all ${
                  paymentMethod === 'TWINT'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone size={18} />
                <span>TWINT</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs gap-1 transition-all ${
                  paymentMethod === 'Cash'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Banknote size={18} />
                <span>Cash</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPayingRental(null)}
                className="flex-1 py-2 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmPayment}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Confirmer payé'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
