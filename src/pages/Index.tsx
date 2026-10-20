import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useCardsForUser, useLinkedPaymentMethods, useRecentTransfersForUser, useWalletViewsForUser } from "@/hooks/use-backend.ts";
import { useProfile } from "@/contexts/profile-context.tsx";
import { getAnonId } from "@/lib/anon-id.ts";
import { midMarketConvert } from "@/convex/fx.ts";
import { PAYMENT_PROVIDERS } from "@/components/ui/add-payment-method-sheet.tsx";
import WalletHistorySheet, { type WalletSummary } from "@/components/ui/wallet-history-sheet.tsx";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  Landmark,
  Plus,
  Repeat,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";

// AppTransfer (supabase/migrations/0005) has no separate credited/debited
// breakdown like Convex's transactions did — credit vs. debit is inferred
// from `type` instead, same pattern as wallet-history-sheet.tsx.
const CREDIT_TX_TYPES = new Set(["deposit", "convert_in"]);

const wallets = [
  { code: "EUR", flag: "🇪🇺", balance: "€3,180.40", change: "▲ 0.6%", up: true, accent: "#0E7FB0" },
  { code: "XAF", flag: "🌍", balance: "2,450,000 XAF", change: "▲ 1.1%", up: true, accent: "#78B72E" },
  { code: "AOA", flag: "🇦🇴", balance: "Kz 6,120,500", change: "▲ 0.8%", up: true, accent: "#C65B2D" },
  { code: "USD", flag: "🇺🇸", balance: "$7,220.10", change: "▲ 1.4%", up: true, accent: "#0A2F5C" },
  { code: "CDF", flag: "🇨🇩", balance: "FC 5.4M", change: "▼ 0.3%", up: false, accent: "#17927E" },
  { code: "AED", flag: "🇦🇪", balance: "د.إ 1,240.00", change: "▲ 0.2%", up: true, accent: "#9A6A0A" },
  { code: "CNY", flag: "🇨🇳", balance: "¥8,960.00", change: "▲ 0.5%", up: true, accent: "#0C7292" },
];

const quickActions = [
  { title: "Add Money", icon: Plus, path: "wallet", bg: "#EAF3EC", fg: "#78B72E" },
  { title: "Send", icon: Send, path: "p2p", bg: "#E9F2F8", fg: "#0E7FB0" },
  { title: "Card", icon: CreditCard, path: "cards", bg: "#EDEBF7", fg: "#0A2F5C" },
  { title: "Convert", icon: Repeat, path: "wallet?tab=convert", bg: "#F1EDFD", fg: "#7A5CF0" },
];

const activity = [
  { name: "Orange Money Top-up", type: "Mobile Money", time: "Today, 2:14 PM", amount: "+$150.00", positive: true, bg: "#FFF0E9", fg: "#E9762E", icon: Send },
  { name: "Kivu Market Store", type: "PayRus Card", time: "Today, 11:02 AM", amount: "-$42.30", positive: false, bg: "#EDEBF7", fg: "#0A2F5C", icon: CreditCard },
  { name: "Sent via M-Pesa", type: "Mobile Money", time: "Yesterday", amount: "-$60.00", positive: false, bg: "#EAF3EC", fg: "#3E8E3F", icon: Send },
];

const channels = [
  { label: "4 Wallets", emoji: "💳" },
  { label: "3 Mobile Money", emoji: "📱" },
  { label: "1 Bank", emoji: "🏦" },
];

export default function Index() {
  const { t } = useTranslation("common");
  const { lng = "en" } = useParams<{ lng?: string }>();
  const [showBalance, setShowBalance] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState("USD");
  const [walletDetail, setWalletDetail] = useState<WalletSummary | null>(null);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const { profile } = useProfile();
  const navigate = useNavigate();
  const goToLinkedChannels = () => navigate(`/${lng}/settings`, { state: { section: "payments" } });

  const currentUser = useCurrentAppUser();
  const displayName = currentUser?.name ?? profile?.name;
  const realWallets = useWalletViewsForUser(currentUser?.id);
  const realCards = useCardsForUser(currentUser?.id);
  const linkedMethods = useLinkedPaymentMethods(getAnonId());
  const recentTx = useRecentTransfersForUser(currentUser?.id, 5);

  const displayCurrency = currentUser?.transactionCurrency ?? "USD";
  const hasRealWallets = !!realWallets && realWallets.length > 0;
  const totalBalance = hasRealWallets
    ? realWallets!.reduce((sum, w) => sum + midMarketConvert(w.balance, w.currency, displayCurrency), 0)
    : null;

  const walletsToShow = realWallets && realWallets.length > 0
    ? realWallets.map((w) => ({
        id: w.id,
        code: w.provider,
        flag: w.flag,
        balance: `${w.currency} ${w.balance.toLocaleString()}`,
        change: "● live",
        up: true,
        accent: "#0E7FB0",
      }))
    : currentUser ? [] : wallets.map((w) => ({ ...w, id: null })); // sample wallets only for the anonymous preview (PRS-BR-006)
  const primaryCard = realCards && realCards.length > 0 ? realCards[0] : null;
  const channelsToShow = linkedMethods && linkedMethods.length > 0
    ? linkedMethods.slice(0, 3).map((m) => {
        const providerMeta = PAYMENT_PROVIDERS.find((p) => p.id === m.provider);
        return { label: providerMeta ? t(providerMeta.labelKey) : m.label, emoji: "💳", icon: providerMeta?.icon };
      })
    : currentUser ? [] : channels.map((c) => ({ ...c, icon: undefined }));

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#F3F7FA",
        backgroundImage: "radial-gradient(rgba(10,47,92,0.06) 1px, transparent 1.2px)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}payrus-mark.png`} alt="" className="h-7 w-auto" />
            <div>
              <div className="text-xs font-semibold text-[#66798F]">Good afternoon</div>
              {displayName && (
                <div className="text-[13px] font-bold text-[#0A2F5C] leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>{displayName}</div>
              )}
              <div className="text-[15px] font-bold text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif" }}>Welcome</div>
            </div>
          </div>
          <Link
            to={`/${lng}/notifications`}
            aria-label="Notifications"
            className="relative w-[38px] h-[38px] rounded-xl bg-white border border-[#E4EAF0] text-[#0A2F5C] flex items-center justify-center"
          >
            <Bell size={18} strokeWidth={1.8} />
            <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[#D6455A] border-[1.5px] border-white" />
          </Link>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-5">
            <div
              className="rounded-[24px] p-[22px] text-white relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#071F3D 0%,#0A2F5C 40%,#0E7FB0 78%,#17927E 100%)",
                boxShadow: "0 10px 26px rgba(10,42,74,0.14)",
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 32%)" }} />
              <svg viewBox="0 0 200 200" className="absolute pointer-events-none" style={{ right: -40, top: -50, opacity: 0.14, width: 220, height: 220 }}>
                <circle cx="100" cy="100" r="95" fill="none" stroke="#fff" strokeWidth="10" />
                <circle cx="100" cy="100" r="65" fill="none" stroke="#fff" strokeWidth="10" />
              </svg>

              <div className="relative flex items-center justify-between">
                <div className="text-[12.5px] font-semibold opacity-85 tracking-wide">TOTAL BALANCE · ALL CHANNELS</div>
                <button type="button" aria-label="Toggle balance visibility" onClick={() => setShowBalance(v => !v)} className="opacity-90 cursor-pointer">
                  {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative mt-3.5 text-[34px] font-extrabold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                {showBalance
                  ? (totalBalance != null
                      ? `${displayCurrency} ${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : currentUser ? `${displayCurrency} 0` : "$12,480.65")
                  : "•••••••••"}
              </div>
              <div className="relative mt-3.5 flex flex-wrap items-center gap-2">
                {hasRealWallets ? (
                  <span className="text-xs opacity-80">across {walletsToShow.length} wallet{walletsToShow.length === 1 ? "" : "s"} · {channelsToShow.length} linked</span>
                ) : currentUser ? (
                  <span className="text-xs opacity-80">No wallets yet</span>
                ) : (
                  <>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>Sample data</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(120,183,46,0.25)", color: "#B9E88F" }}>▲ 3.2% this month</span>
                    <span className="text-xs opacity-80">across 7 wallets · 3 mobile money · 1 bank</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif" }}>Your Wallets</span>
                <span className="text-xs font-bold text-[#0E7FB0]">Tap to select</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {walletsToShow.map(({ id, code, flag, balance, change, up, accent }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setSelectedWallet(code);
                      setWalletDetail({ id, code, flag, balance });
                      setWalletSheetOpen(true);
                    }}
                    className="min-w-0 rounded-2xl bg-white p-4 text-left flex flex-col gap-2.5 cursor-pointer"
                    style={{
                      borderLeft: `4px solid ${accent}`,
                      boxShadow: selectedWallet === code ? "0 0 0 2px #0A2F5C" : "0 1px 2px rgba(10,42,74,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-extrabold truncate" style={{ color: accent }}>{code}</span>
                      <span className="text-sm shrink-0">{flag}</span>
                    </div>
                    <div className="text-[17px] font-bold text-[#0B2A4A] truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{balance}</div>
                    <div className="text-[11px] font-bold" style={{ color: up ? "#3E8E3F" : "#D6455A" }}>{change}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {quickActions.map(({ title, icon: Icon, path, bg, fg }) => (
                <Link key={title} to={`/${lng}/${path}`} className="flex flex-col items-center gap-1.5">
                  <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center" style={{ background: bg, color: fg }}>
                    <Icon size={21} strokeWidth={1.9} />
                  </div>
                  <span className="text-[11px] font-bold text-[#66798F]">{title}</span>
                </Link>
              ))}
            </div>

            <div className="rounded-[20px] bg-white border border-[#E4EAF0] p-4 flex flex-col gap-3" style={{ boxShadow: "0 1px 2px rgba(10,42,74,0.06)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif" }}>Connected Channels</span>
                <span className="text-xs font-bold text-[#0E7FB0]">{walletsToShow.length} wallets · {channelsToShow.length} linked</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {channelsToShow.map(({ label, emoji }) => (
                  <span key={label} className="px-3.5 py-2 rounded-xl bg-white border border-[#E4EAF0] text-xs font-bold text-[#66798F]">{emoji} {label}</span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-[15px] font-bold text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif" }}>Recent Activity</span>
              <div className="flex flex-col gap-2.5">
                {currentUser && recentTx && recentTx.length > 0 ? (
                  recentTx.map((tx) => {
                    const isCredit = CREDIT_TX_TYPES.has(tx.type);
                    const wallet = realWallets?.find(w => w.id === tx.walletViewId);
                    const typeIcons: Record<string, typeof Send> = { transfer: Send, payment: CreditCard, remittance: Globe, deposit: Plus, convert_out: Repeat, convert_in: Repeat };
                    const Icon = isCredit ? ArrowDownLeft : (typeIcons[tx.type] ?? Send);
                    const typeLabels: Record<string, string> = { transfer: "Transfer", payment: "Payment", remittance: "Remittance", deposit: "Deposit", convert_out: "Conversion out", convert_in: "Conversion in" };
                    return (
                      <Link key={tx.id} to={`/${lng}/transactions/${encodeURIComponent(tx.reference)}`} aria-label={`${typeLabels[tx.type] ?? tx.type} ${tx.reference}`} className="rounded-[20px] bg-white border border-[#E4EAF0] p-3.5 flex items-center gap-3 hover:border-[#0A2F5C]/30 transition-colors" style={{ boxShadow: "0 1px 2px rgba(10,42,74,0.06)" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isCredit ? "#EAF3EC" : "#EDEBF7", color: isCredit ? "#3E8E3F" : "#0A2F5C" }}>
                          <Icon size={18} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-bold text-[#0B2A4A]">{typeLabels[tx.type] ?? tx.type} {wallet ? `· ${wallet.flag} ${wallet.currency}` : ""}</div>
                          <div className="text-[11.5px] text-[#9BAAB9]">{new Date(tx.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-sm font-extrabold" style={{ color: isCredit ? "#3E8E3F" : "#0B2A4A" }}>
                          {isCredit ? "+" : "-"}{tx.currency} {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                      </Link>
                    );
                  })
                ) : currentUser ? (
                  <div className="rounded-[20px] bg-white border border-[#E4EAF0] p-4 text-center text-xs text-[#9BAAB9]">No activity yet — add money or send a transfer to see it here.</div>
                ) : (
                  activity.map(({ name, type, time, amount, positive, bg, fg, icon: Icon }) => (
                    <div key={name} className="rounded-[20px] bg-white border border-[#E4EAF0] p-3.5 flex items-center gap-3" style={{ boxShadow: "0 1px 2px rgba(10,42,74,0.06)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color: fg }}>
                        <Icon size={18} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold text-[#0B2A4A]">{name}</div>
                        <div className="text-[11.5px] text-[#9BAAB9]">{time} · {type}</div>
                      </div>
                      <div className="text-sm font-extrabold" style={{ color: positive ? "#3E8E3F" : "#0B2A4A" }}>{amount}</div>
                    </div>
                  ))
                )}
              </div>
              <Link to={`/${lng}/transactions`} className="self-start inline-flex items-center gap-1 text-xs font-bold text-[#0E7FB0]">
                See all activity <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[20px] bg-white border border-[#E4EAF0] p-4" style={{ boxShadow: "0 1px 2px rgba(10,42,74,0.06)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9BAAB9]">Your Card</div>
                  <div className="mt-1 text-sm font-bold text-[#0B2A4A]">•••• {primaryCard ? primaryCard.last4 : "4471"}</div>
                </div>
                <Link to={`/${lng}/cards`} className="inline-flex items-center gap-1 text-xs font-bold text-[#0E7FB0]">
                  Manage card
                  <ChevronRight size={14} />
                </Link>
              </div>

              <div
                className="mt-4 rounded-2xl p-4 text-white"
                style={{
                  background: "linear-gradient(135deg,#071F3D 0%,#0A2F5C 40%,#0E7FB0 78%,#17927E 100%)",
                  boxShadow: "0 18px 30px rgba(10,47,92,0.22)",
                }}
              >
                <div className="flex items-center justify-between">
                  <img src={`${import.meta.env.BASE_URL}payrus-mark.png`} alt="" className="h-5 w-auto" draggable={false} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">{primaryCard?.brand ?? "Visa"}</span>
                </div>
                <div className="mt-8 text-[15px] font-semibold tracking-[0.12em]" style={{ fontFamily: "'Sora', sans-serif" }}>•••• •••• •••• {primaryCard ? primaryCard.last4 : "4471"}</div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/60">Card holder</div>
                    <div className="mt-1 text-[13px] font-bold">{primaryCard ? primaryCard.holder : (displayName ?? "JEAN DUPONT").toUpperCase()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/60">Expires</div>
                    <div className="mt-1 text-[13px] font-bold">{primaryCard?.expiry ?? "09/27"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] bg-white border border-[#E4EAF0] p-4" style={{ boxShadow: "0 1px 2px rgba(10,42,74,0.06)" }}>
              <span className="text-[15px] font-bold text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif" }}>Linked Services</span>
              <div className="mt-3 flex flex-col gap-2">
                {channelsToShow.map(({ label, icon }, i) => {
                  const IconComp = icon ?? [Wallet, Send, Landmark][i] ?? Wallet;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={goToLinkedChannels}
                      className="flex items-center justify-between rounded-2xl bg-[#F3F7FA] p-3 cursor-pointer hover:bg-[#EAF0F5] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white text-[#0A2F5C]">
                          <IconComp size={16} strokeWidth={1.8} />
                        </div>
                        <span className="text-sm font-semibold text-[#0B2A4A]">{label}</span>
                      </div>
                      <ArrowRight size={16} className="text-[#9BAAB9]" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={goToLinkedChannels}
                className="mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(90deg,#78B72E 0%,#17927E 55%,#0E7FB0 100%)", boxShadow: "0 10px 22px rgba(10,42,74,0.16)" }}
              >
                Manage channels
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <WalletHistorySheet wallet={walletDetail} open={walletSheetOpen} onOpenChange={setWalletSheetOpen} />
    </div>
  );
}
