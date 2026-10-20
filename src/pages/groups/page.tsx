import { useState } from "react";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Users, Plus, Send, ChevronRight, CheckCircle, X, Search,
  Briefcase, Heart, Shield, Star, Crown, UserCheck, Banknote,
  FileText, Gift, BadgeCheck, Building2, ArrowRight, Upload,
  Settings2, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { PayRusLogo } from "@/pages/layout/AppLayout.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  useApplyWalletTransferMutation, useAddGroupMemberMutation, useCreateGroupMutation,
  useGroupMembers, useGroupsForUser,
} from "@/hooks/use-backend.ts";
import type { AppGroup } from "@/lib/backend.ts";

/* ─── Types ────────────────────────────────────────────── */
type GroupType = "employees" | "friends" | "volunteers" | "officials" | "private" | "vip";
type PaymentType = "salary" | "bonus" | "voucher" | "gift" | "allowance" | "incentive";

type GroupMember = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  country: string;
  flag: string;
  currency: string;
  customAmount?: number;
  selected: boolean;
};

const GROUP_ICONS: Record<GroupType, React.ComponentType<{ size?: number; className?: string }>> = {
  employees: Briefcase,
  friends: Heart,
  volunteers: UserCheck,
  officials: Shield,
  private: Star,
  vip: Crown,
};

const GROUP_LABEL_KEYS: Record<GroupType, string> = {
  employees: "groups.type.employees",
  friends: "groups.type.friends",
  volunteers: "groups.type.volunteers",
  officials: "groups.type.officials",
  private: "groups.type.private",
  vip: "groups.type.vip",
};

const GROUP_COLORS: Record<GroupType, string> = {
  employees: "text-blue-700 bg-blue-50 border-blue-200",
  friends: "text-pink-700 bg-pink-50 border-pink-200",
  volunteers: "text-green-700 bg-green-50 border-green-200",
  officials: "text-amber-700 bg-amber-50 border-amber-200",
  private: "text-purple-700 bg-purple-50 border-purple-200",
  vip: "text-yellow-700 bg-yellow-50 border-yellow-200",
};

const PAYMENT_TYPES: { id: PaymentType; labelKey: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "salary", labelKey: "groups.paymentType.salary", icon: Banknote },
  { id: "bonus", labelKey: "groups.paymentType.bonus", icon: Star },
  { id: "voucher", labelKey: "groups.paymentType.voucher", icon: FileText },
  { id: "gift", labelKey: "groups.paymentType.gift", icon: Gift },
  { id: "allowance", labelKey: "groups.paymentType.allowance", icon: Shield },
  { id: "incentive", labelKey: "groups.paymentType.incentive", icon: BadgeCheck },
];

const MOCK_GROUPS = [
  {
    id: "g1",
    name: "groups.group.kinshasaTeam",
    type: "employees" as GroupType,
    memberCount: 24,
    currency: "CDF",
    lastPayment: "Jul 15, 2026",
  },
  {
    id: "g2",
    name: "groups.group.boardOfDirectors",
    type: "officials" as GroupType,
    memberCount: 7,
    currency: "USD",
    lastPayment: "Aug 1, 2026",
  },
  {
    id: "g3",
    name: "groups.group.salesTeam",
    type: "employees" as GroupType,
    memberCount: 12,
    currency: "XAF",
    lastPayment: "Jul 15, 2026",
  },
  {
    id: "g4",
    name: "groups.group.ngoPartners",
    type: "volunteers" as GroupType,
    memberCount: 18,
    currency: "USD",
    lastPayment: "Jul 1, 2026",
  },
  {
    id: "g5",
    name: "groups.group.vipAmbassadors",
    type: "vip" as GroupType,
    memberCount: 5,
    currency: "EUR",
    lastPayment: "Aug 10, 2026",
  },
  {
    id: "g6",
    name: "groups.group.familyAndFriends",
    type: "private" as GroupType,
    memberCount: 9,
    currency: "CDF",
    lastPayment: "Aug 5, 2026",
  },
];

const MOCK_MEMBERS: GroupMember[] = [
  { id: "m1", name: "Amara Koné", avatar: "AK", role: "groups.role.hrDirector", country: "p2p.country.cd", flag: "🇨🇩", currency: "CDF", customAmount: 1500000, selected: true },
  { id: "m2", name: "Jean Makoko", avatar: "JM", role: "groups.role.projectManager", country: "p2p.country.cg", flag: "🇨🇬", currency: "XAF", customAmount: 900000, selected: true },
  { id: "m3", name: "Alice Umuhu", avatar: "AU", role: "groups.role.accountant", country: "p2p.country.rw", flag: "🇷🇼", currency: "RWF", customAmount: 500000, selected: true },
  { id: "m4", name: "Paulo Damba", avatar: "PD", role: "groups.role.technician", country: "p2p.country.ao", flag: "🇦🇴", currency: "AOA", customAmount: 400000, selected: false },
  { id: "m5", name: "Fatou Diallo", avatar: "FD", role: "groups.role.salesRep", country: "p2p.country.sn", flag: "🇸🇳", currency: "XOF", customAmount: 600000, selected: true },
  { id: "m6", name: "Chioma Obi", avatar: "CO", role: "groups.role.developer", country: "p2p.country.ng", flag: "🇳🇬", currency: "NGN", customAmount: 800000, selected: false },
];

const AVATAR_COLORS: Record<string, string> = {
  AK: "bg-purple-600", JM: "bg-teal-600", AU: "bg-pink-600", PD: "bg-orange-600",
  FD: "bg-emerald-600", CO: "bg-rose-600", KA: "bg-blue-600", ND: "bg-indigo-600",
};

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", sz, AVATAR_COLORS[initials] ?? "bg-primary")}>
      {initials}
    </div>
  );
}

type GroupCardData = { id: string; name: string; type: GroupType; memberCount: number; currency: string; lastPayment: string };

export default function GroupTransfers() {
  const { t } = useTranslation("common");
  const currentUser = useCurrentAppUser();
  const realGroups = useGroupsForUser(currentUser?.id);
  const createGroupMutation = useCreateGroupMutation();
  const addGroupMemberMutation = useAddGroupMemberMutation();
  const applyTransaction = useApplyWalletTransferMutation();

  const [activeView, setActiveView] = useState<"groups" | "new-payment" | "confirm" | "success">("groups");
  const [selectedGroup, setSelectedGroup] = useState<GroupCardData | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("salary");
  const [currency, setCurrency] = useState("CDF");
  const [baseAmount, setBaseAmount] = useState("");
  const [members, setMembers] = useState(MOCK_MEMBERS);
  const [showCurrencyDrop, setShowCurrencyDrop] = useState(false);
  const [query, setQuery] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<GroupType>("employees");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [realSelectedIds, setRealSelectedIds] = useState<Set<string>>(new Set());
  const [sendingPayment, setSendingPayment] = useState(false);

  // Real groups when signed in with at least one; anonymous/no-real-groups
  // visitors keep the existing fictional directory — same fallback
  // convention used throughout this migration.
  const hasReal = !!currentUser && !!realGroups && realGroups.length > 0;
  const realGroupsAsCards: GroupCardData[] = hasReal
    ? realGroups.map(g => ({ id: g.id, name: g.name, type: g.type, memberCount: 0, currency: g.currency, lastPayment: "—" }))
    : [];
  const groupsToShow: GroupCardData[] = hasReal ? realGroupsAsCards : MOCK_GROUPS;
  const isRealSelectedGroup = hasReal && !!selectedGroup && realGroups!.some(g => g.id === selectedGroup.id);

  const realMembers = useGroupMembers(isRealSelectedGroup ? selectedGroup!.id : undefined, currentUser?.id);

  const selectedMembers = members.filter(m => m.selected);
  const realSelectedMembers = (realMembers ?? []).filter(m => realSelectedIds.has(m.id));
  const totalAmount = isRealSelectedGroup
    ? realSelectedMembers.length * (parseFloat(baseAmount) || 0)
    : selectedMembers.reduce((sum, m) => sum + (m.customAmount ?? (parseFloat(baseAmount) || 0)), 0);
  const payrusMargin = totalAmount * 0.075;
  const grandTotal = totalAmount + payrusMargin;
  const paymentTypeObj = PAYMENT_TYPES.find(p => p.id === paymentType);
  const paymentTypeLabel = paymentTypeObj ? t(paymentTypeObj.labelKey) : "—";

  function toggleMember(id: string) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  }

  function toggleRealMember(id: string) {
    setRealSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openGroup(group: GroupCardData) {
    setSelectedGroup(group);
    setRealSelectedIds(new Set());
    setActiveView("new-payment");
  }

  async function handleAddRealMember() {
    if (!memberIdentifier.trim() || !selectedGroup || !currentUser) return;
    setAddingMember(true);
    try {
      const member = await addGroupMemberMutation({ groupId: selectedGroup.id, ownerUserId: currentUser.id, identifier: memberIdentifier.trim() });
      setRealSelectedIds(prev => new Set(prev).add(member.id));
      setMemberIdentifier("");
      toast.success(t("groups.memberAdded"));
    } catch {
      toast.error(t("groups.memberNotFound"));
    } finally {
      setAddingMember(false);
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !currentUser) return;
    setCreatingGroup(true);
    try {
      await createGroupMutation({ ownerUserId: currentUser.id, name: newGroupName.trim(), type: newGroupType, currency });
      toast.success(t("groups.groupCreated"));
      setShowNewGroup(false);
      setNewGroupName("");
    } catch {
      toast.error(t("groups.groupCreateFailed"));
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleRealValidate() {
    if (!currentUser || !selectedGroup) return;
    setSendingPayment(true);
    try {
      for (const m of realSelectedMembers) {
        await applyTransaction({
          userId: currentUser.id, amount: parseFloat(baseAmount) || 0, currency,
          type: "transfer", note: `Group: ${selectedGroup.name} — ${m.maskedEmail}`,
        });
      }
      setActiveView("success");
      toast.success(t("groups.groupPaymentSentToast"));
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "groups.paymentFailed"));
    } finally {
      setSendingPayment(false);
    }
  }

  const filteredMembers = query.trim()
    ? members.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || t(m.role).toLowerCase().includes(query.toLowerCase()))
    : members;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader title={t("groups.title")} className="mb-4 md:mb-6" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <PayRusLogo className="h-5 w-auto" />
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("groups.heading")}</h1>
          <p className="text-xs text-muted-foreground">{t("groups.subtitle")}</p>
        </div>
        <button
          onClick={() => currentUser ? setShowNewGroup(true) : toast.info(t("groups.signInToCreate"))}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
        >
          <Plus size={13} /> {t("groups.newGroup")}
        </button>
      </div>

      {/* New group form (real, signed-in only) */}
      {showNewGroup && (
        <div className="mb-5 rounded-xl bg-card border border-border p-4 space-y-3">
          <input
            value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder={t("groups.groupNamePlaceholder")}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <select value={newGroupType} onChange={e => setNewGroupType(e.target.value as GroupType)} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm">
            {(Object.keys(GROUP_LABEL_KEYS) as GroupType[]).map(gt => <option key={gt} value={gt}>{t(GROUP_LABEL_KEYS[gt])}</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNewGroup(false)}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={creatingGroup} onClick={() => void handleCreateGroup()}>
              {creatingGroup ? t("signin.checking") : t("groups.createNewGroup")}
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── Groups list ─── */}
        {activeView === "groups" && (
          <motion.div key="groups" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: t("groups.activeGroups"), value: "6", sub: t("groups.statActiveSub") },
                { label: t("groups.totalMembers"), value: "75", sub: t("groups.statMembersSub") },
                { label: t("groups.lastSent"), value: "XAF 8.5M", sub: t("groups.statLastSentSub") },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-card border border-border p-3 text-center">
                  <div className="text-lg font-bold font-mono text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  <div className="text-[10px] text-primary mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Group cards */}
            {groupsToShow.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">{t("groups.noGroupsYet")}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {groupsToShow.map(group => {
                const Icon = GROUP_ICONS[group.type];
                const colorClass = GROUP_COLORS[group.type];
                return (
                  <motion.button
                    key={group.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => openGroup(group)}
                    className="text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold", colorClass)}>
                        <Icon size={12} />
                        {t(GROUP_LABEL_KEYS[group.type])}
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="font-bold text-foreground mb-1">{t(group.name)}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users size={11} />
                        {t("groups.membersCount", { count: group.memberCount })}
                      </div>
                      <span>{group.currency}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {t("groups.lastPaymentLabel", { date: group.lastPayment })}
                    </div>
                  </motion.button>
                );
              })}

              {/* Add group button */}
              <button
                onClick={() => currentUser ? setShowNewGroup(true) : toast.info(t("groups.signInToCreate"))}
                className="text-left p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 min-h-[120px]"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Plus size={18} className="text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground text-center">{t("groups.createNewGroup")}</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── New payment ─── */}
        {activeView === "new-payment" && selectedGroup && (
          <motion.div key="new-payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

            {/* Back + group info */}
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveView("groups")} className="text-muted-foreground hover:text-foreground cursor-pointer p-1">
                <X size={16} />
              </button>
              <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold", GROUP_COLORS[selectedGroup.type])}>
                {(() => { const Icon = GROUP_ICONS[selectedGroup.type]; return <Icon size={12} />; })()}
                {selectedGroup.name}
              </div>
              <span className="text-xs text-muted-foreground">{t("groups.membersCount", { count: selectedGroup.memberCount })}</span>
            </div>

            {/* Payment type */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("groups.paymentTypeLabel")}</div>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_TYPES.map(pt => (
                  <button
                    key={pt.id}
                    onClick={() => setPaymentType(pt.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                      paymentType === pt.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-primary/5"
                    )}
                  >
                    <pt.icon size={15} />
                    {t(pt.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + currency */}
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("groups.baseAmount")}</div>
              <div className="flex gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowCurrencyDrop(!showCurrencyDrop)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm font-bold hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    {currency} <ChevronDown size={12} />
                  </button>
                  {showCurrencyDrop && (
                    <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-xl shadow-xl w-24">
                      {["CDF", "XAF", "USD", "EUR", "XOF"].map(c => (
                        <button key={c} onClick={() => { setCurrency(c); setShowCurrencyDrop(false); }} className={cn("w-full px-3 py-2 text-sm text-left hover:bg-primary/10 cursor-pointer", c === currency && "text-primary")}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  value={baseAmount}
                  onChange={e => setBaseAmount(e.target.value)}
                  placeholder={t("groups.baseAmountPlaceholder")}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{t("groups.baseAmountNote")}</p>
            </div>

            {/* Member list */}
            {isRealSelectedGroup ? (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t("groups.recipientsSelected", { count: realSelectedMembers.length })}
                </div>

                {/* Real member lookup — reuses the same real-identifier
                    pattern as p2p/page.tsx, since group members are real
                    registered users, not a browsable fictional roster. */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text" value={memberIdentifier} onChange={e => setMemberIdentifier(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void handleAddRealMember(); }}
                    placeholder={t("groups.addMemberPlaceholder")}
                    className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={() => void handleAddRealMember()} disabled={addingMember || !memberIdentifier.trim()}
                    className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {addingMember ? t("signin.checking") : t("groups.addMember")}
                  </button>
                </div>

                <div className="space-y-2">
                  {(realMembers ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">{t("groups.noMembersYet")}</p>
                  )}
                  {(realMembers ?? []).map(m => {
                    const isSelected = realSelectedIds.has(m.id);
                    return (
                      <div key={m.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", isSelected ? "border-primary/30 bg-primary/5" : "border-border bg-secondary opacity-60")}>
                        <button onClick={() => toggleRealMember(m.id)} className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all", isSelected ? "bg-primary border-primary" : "border-border bg-transparent")}>
                          {isSelected && <CheckCircle size={12} className="text-primary-foreground" />}
                        </button>
                        <Avatar initials={m.maskedEmail.slice(0, 2).toUpperCase()} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{m.maskedEmail}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold font-mono text-foreground">{baseAmount || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{currency}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("groups.recipientsSelected", { count: selectedMembers.length })}
                  </div>
                  <button onClick={() => setMembers(prev => prev.map(m => ({ ...m, selected: !selectedMembers.length || selectedMembers.length < members.length })))} className="text-[10px] text-primary cursor-pointer hover:underline">
                    {selectedMembers.length === members.length ? t("groups.deselectAll") : t("groups.selectAll")}
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t("groups.searchMemberPlaceholder")}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div className="space-y-2">
                  {filteredMembers.map(m => (
                    <div key={m.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", m.selected ? "border-primary/30 bg-primary/5" : "border-border bg-secondary opacity-60")}>
                      <button onClick={() => toggleMember(m.id)} className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all", m.selected ? "bg-primary border-primary" : "border-border bg-transparent")}>
                        {m.selected && <CheckCircle size={12} className="text-primary-foreground" />}
                      </button>
                      <Avatar initials={m.avatar} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{t(m.role)} · {m.flag} {t(m.country)}</div>                    </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono text-foreground">
                          {m.customAmount ? m.customAmount.toLocaleString() : (baseAmount || "—")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{m.currency}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {(isRealSelectedGroup ? realSelectedMembers.length : selectedMembers.length) > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                {[
                  [t("groups.beneficiaries"), t("groups.membersCount", { count: isRealSelectedGroup ? realSelectedMembers.length : selectedMembers.length })],
                  [t("groups.subtotal"), `${currency} ${totalAmount.toLocaleString()}`],
                  [t("groups.fee"), `${currency} ${payrusMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-muted-foreground">
                    <span>{k}</span><span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-primary/20">
                  <span className="text-primary">{t("groups.totalToDisburse")}</span>
                  <span className="text-primary">{currency} {grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            )}

            <Button
              className="w-full gap-2 font-bold cursor-pointer"
              disabled={isRealSelectedGroup ? realSelectedMembers.length === 0 : selectedMembers.length === 0}
              onClick={() => {
                if (isRealSelectedGroup) {
                  if (!baseAmount || parseFloat(baseAmount) <= 0) { toast.error(t("groups.enterAmountToast")); return; }
                  setActiveView("confirm");
                  return;
                }
                if (!baseAmount && selectedMembers.every(m => !m.customAmount)) {
                  toast.error(t("groups.enterAmountToast"));
                  return;
                }
                setActiveView("confirm");
              }}
            >
              <Send size={15} /> {t("groups.confirmGroupPayment")}
            </Button>
          </motion.div>
        )}

        {/* ── Confirm ─── */}
        {activeView === "confirm" && selectedGroup && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="bg-gradient-to-r from-primary/20 to-accent/10 px-5 py-4 border-b border-border flex items-center gap-3">
                <div className="rounded-md bg-white px-2 py-0.5">
                  <PayRusLogo className="h-4 w-auto" />
                </div>
                <span className="font-bold text-foreground">{t("groups.confirmGroupPaymentTitle")}</span>
              </div>
              <div className="p-5 space-y-3">
                {[
                  [t("groups.group"), selectedGroup.name],
                  [t("groups.typeLabel"), paymentTypeLabel],
                  [t("groups.beneficiaries"), t("groups.membersCount", { count: isRealSelectedGroup ? realSelectedMembers.length : selectedMembers.length })],
                  [t("groups.currency"), currency],
                  [t("groups.subtotal"), `${currency} ${totalAmount.toLocaleString()}`],
                  [t("groups.fee"), `${currency} ${payrusMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                  [t("groups.totalDisbursed"), `${currency} ${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="font-semibold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setActiveView("new-payment")} className="cursor-pointer">{t("groups.editButton")}</Button>
              <Button
                className="gap-2 font-bold cursor-pointer"
                disabled={sendingPayment}
                onClick={() => {
                  if (isRealSelectedGroup) { void handleRealValidate(); return; }
                  setActiveView("success");
                  toast.success(t("groups.groupPaymentSentToast"));
                }}
              >
                <CheckCircle size={15} /> {sendingPayment ? t("signin.checking") : t("groups.validate")}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Success ─── */}
        {activeView === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 flex flex-col items-center gap-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }} className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle size={40} className="text-primary" />
              </motion.div>
              <div>
                <div className="text-2xl font-bold text-foreground">{t("groups.groupPaymentSentToast")}</div>
                <div className="text-sm text-muted-foreground mt-1">{t("groups.membersNotified", { count: selectedMembers.length })}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-1.5 shadow-sm">
                <PayRusLogo className="h-5 w-auto" />
              </div>
              <div className="font-mono text-xs text-muted-foreground">REF: GRP-{Date.now().toString(36).toUpperCase()}</div>
            </div>
            <Button className="w-full gap-2 cursor-pointer" onClick={() => { setActiveView("groups"); setSelectedGroup(null); setBaseAmount(""); }}>
              <ArrowRight size={15} /> {t("groups.backToGroups")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
