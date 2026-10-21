import { formatCompact } from "@/lib/format-compact.ts";
import { weekdayName } from "@/lib/i18n-labels.ts";
import { useState, useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Zap, Trophy, Star, RefreshCw, Plus, Minus, CheckCircle,
  AlertTriangle, Wallet, TrendingUp, Clock, ChevronRight,
  Shield, Heart, X, Flame, Target, CircleDollarSign,
  RotateCcw, Ticket, Users, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useWalletViewsForUser, usePlaceBetMutation, useResolveBetMutation } from "@/hooks/use-backend.ts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type GameTab = "lotto" | "sports" | "scratch" | "wallet" | "responsible";

// Real money mode (signed in): stakes debit and payouts credit the real
// PayRus wallet directly via placeBet/resolveBet — resolution is decided
// server-side (supabase/migrations/0018), never trusted from the client.
// Anonymous/demo visitors keep the exact previous play-money simulation.
type PlaceBetFn = ReturnType<typeof usePlaceBetMutation>;
type ResolveBetFn = ReturnType<typeof useResolveBetMutation>;
interface RealMoneyProps {
  isReal: boolean;
  currentUserId: string | undefined;
  currency: string;
  placeBet: PlaceBetFn;
  resolveBet: ResolveBetFn;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LOTTO_MAX = 42;
const LOTTO_PICK = 6;
const TICKET_COST = 500; // XAF

const FOOTBALL_MATCHES = [
  { id: 1, home: "TP Mazembe", away: "Tout Puissant Sporting", league: "Linafoot · DRC", time: "Sat 16:00", homeOdds: 2.1, drawOdds: 3.2, awayOdds: 3.8 },
  { id: 2, home: "Coton Sport", away: "Canon Yaoundé", league: "Elite One · CMR", time: "Sat 18:30", homeOdds: 1.8, drawOdds: 3.5, awayOdds: 4.2 },
  { id: 3, home: "AS Vita Club", away: "St Eloi Lupopo", league: "Linafoot · DRC", time: "Sun 14:00", homeOdds: 2.4, drawOdds: 3.1, awayOdds: 2.9 },
  { id: 4, home: "Étoile du Congo", away: "CARA Brazzaville", league: "D1 · COG", time: "Sun 16:00", homeOdds: 2.0, drawOdds: 3.3, awayOdds: 3.6 },
  { id: 5, home: "Fovu Baham", away: "Union de Douala", league: "Elite One · CMR", time: "Sun 19:00", homeOdds: 2.2, drawOdds: 3.4, awayOdds: 3.0 },
  { id: 6, home: "Olympique RCA", away: "Tempête Mocaf", league: "Ligue 1 · RCA", time: "Mon 15:30", homeOdds: 1.9, drawOdds: 3.2, awayOdds: 4.1 },
];

const BASKETBALL_MATCHES = [
  { id: 7, home: "Congo Lions", away: "Brazza Hawks", league: "BAL Zone · COG", time: "Fri 20:00", homeOdds: 1.7, drawOdds: 0, awayOdds: 2.1 },
  { id: 8, home: "Kin Eagles", away: "Lubumbashi BC", league: "BAL Zone · DRC", time: "Sat 21:00", homeOdds: 2.3, drawOdds: 0, awayOdds: 1.6 },
];

const SCRATCH_PRIZES = [0, 0, 0, 500, 0, 1000, 0, 5000, 0, 50000];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `${formatCompact(n, 2)} XAF`;
}

function randomPick(n: number, max: number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result.sort((a, b) => a - b);
}

// ─── LOTTO SECTION ────────────────────────────────────────────────────────────

function LottoSection({ gameBalance, onDeduct, onCredit, isReal, currentUserId, currency, placeBet, resolveBet }: {
  gameBalance: number;
  onDeduct: (n: number) => void;
  onCredit: (n: number) => void;
} & RealMoneyProps) {
  const { t, i18n } = useTranslation("common");
  const [picked, setPicked] = useState<number[]>([]);
  const [drawResult, setDrawResult] = useState<number[] | null>(null);
  const [animating, setAnimating] = useState(false);
  const [matches, setMatches] = useState(0);
  const [showResult, setShowResult] = useState(false);

  // Next draw countdown (static demo)
  const nextDraw = `${weekdayName(3, i18n.language)} 20:00`;
  const prizePool = 48750000;
  const jackpot = 120000000;

  function toggleNumber(n: number) {
    if (picked.includes(n)) {
      setPicked(prev => prev.filter(x => x !== n));
    } else if (picked.length < LOTTO_PICK) {
      setPicked(prev => [...prev, n].sort((a, b) => a - b));
    }
  }

  function quickPick() {
    setPicked(randomPick(LOTTO_PICK, LOTTO_MAX));
  }

  async function playLottoReal() {
    if (!currentUserId) return;
    setAnimating(true);
    setShowResult(false);
    setDrawResult(null);
    try {
      const bet = await placeBet({ userId: currentUserId, kind: "lotto", stakeAmount: TICKET_COST, currency, meta: { picks: picked } });
      await new Promise((r) => setTimeout(r, 2200));
      const resolved = await resolveBet({ betId: bet.id, userId: currentUserId });
      const payout = resolved.payoutAmount ?? 0;
      // The draw itself happens inside resolve_bet and isn't returned to the
      // client — only the payout is, so matches are inferred from the fixed
      // payout tiers rather than shown as real drawn balls (see LOTTO_PICK grid).
      const m = payout === jackpot ? 6 : payout === 500000 ? 5 : payout === 25000 ? 4 : payout === 2000 ? 3 : 0;
      setMatches(m);
      setAnimating(false);
      setShowResult(true);
      if (resolved.status === "won") {
        toast.success(`🎉 ${m} matches! You won ${fmt(payout)}!`);
      } else {
        toast.info(t("games.noPrizeThisTime"));
      }
    } catch {
      setAnimating(false);
      toast.error(t("games.couldnTPlaceThe"));
    }
  }

  function playLotto() {
    if (picked.length < LOTTO_PICK) {
      toast.error(`Pick ${LOTTO_PICK} numbers to play`);
      return;
    }
    if (isReal) {
      void playLottoReal();
      return;
    }
    if (gameBalance < TICKET_COST) {
      toast.error(t("games.insufficientGameWalletBalance"));
      return;
    }
    onDeduct(TICKET_COST);
    setAnimating(true);
    setShowResult(false);
    setDrawResult(null);

    setTimeout(() => {
      const result = randomPick(LOTTO_PICK, LOTTO_MAX);
      setDrawResult(result);
      const m = picked.filter(n => result.includes(n)).length;
      setMatches(m);
      setAnimating(false);
      setShowResult(true);

      let prize = 0;
      if (m === 6) prize = jackpot;
      else if (m === 5) prize = 500000;
      else if (m === 4) prize = 25000;
      else if (m === 3) prize = 2000;

      if (prize > 0) {
        onCredit(prize);
        toast.success(`🎉 ${m} matches! You won ${fmt(prize)}!`);
      } else {
        toast.info(`${m} match${m !== 1 ? "es" : ""}. Better luck next time!`);
      }
    }, 2200);
  }

  const PRIZE_TABLE = [
    { match: 6, prize: "Jackpot", amount: jackpot, color: "text-amber-700" },
    { match: 5, prize: "2nd Prize", amount: 500000, color: "text-primary" },
    { match: 4, prize: "3rd Prize", amount: 25000, color: "text-accent" },
    { match: 3, prize: "4th Prize", amount: 2000, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      {/* Prize pool banner */}
      <div className="bg-gradient-to-br from-amber-900/40 to-amber-700/10 border border-amber-200 rounded-2xl p-5 text-center space-y-1">
        <div className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">{t("games.currentJackpot")}</div>
        <div className="text-4xl font-black font-mono text-amber-300">{fmt(jackpot)}</div>
        <div className="text-xs text-muted-foreground">{t("games.prizePoolNextDraw", { pool: fmt(prizePool), nextDraw })}</div>
        <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Ticket size={11} />{t("games.1Ticket")} {fmt(TICKET_COST)}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Users size={11} />{t("games.12840TicketsSold")}</span>
        </div>
      </div>

      {/* Number grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold">{t("games.pickNumbers", { n: LOTTO_PICK })} <span className="text-muted-foreground font-normal">({picked.length}/{LOTTO_PICK})</span></span>
          <button onClick={quickPick} className="text-xs text-primary font-semibold flex items-center gap-1 cursor-pointer hover:underline">
            <Zap size={11} /> {t("games.quickPick")}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: LOTTO_MAX }, (_, i) => i + 1).map(n => {
            const isPicked = picked.includes(n);
            const isResult = drawResult?.includes(n);
            const isMatch = isPicked && isResult;
            return (
              <motion.button
                key={n}
                whileTap={{ scale: 0.9 }}
                onClick={() => toggleNumber(n)}
                className={cn(
                  "aspect-square rounded-xl text-sm font-black transition-all cursor-pointer border",
                  isMatch ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-110" :
                    isPicked ? "bg-primary/20 text-primary border-primary/50" :
                      isResult ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-secondary border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {n}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Draw result */}
      <AnimatePresence>
        {(animating || showResult) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-2xl p-4 text-center space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("games.drawResult")}</div>
            {animating ? (
              <div className="flex justify-center gap-2">
                {Array.from({ length: LOTTO_PICK }).map((_, i) => (
                  <motion.div key={i} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center">
                    <span className="text-muted-foreground text-lg">?</span>
                  </motion.div>
                ))}
              </div>
            ) : drawResult ? (
              <div className="space-y-2">
                <div className="flex justify-center gap-2 flex-wrap">
                  {drawResult.map((n, i) => (
                    <motion.div key={n} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.1, type: "spring" as const, stiffness: 260 }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border",
                        picked.includes(n) ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                      {n}
                    </motion.div>
                  ))}
                </div>
                <div className={cn("text-sm font-bold", matches >= 3 ? "text-primary" : "text-muted-foreground")}>
                  {matches === 6 ? t("games.jackpot") : matches >= 3 ? `${matches} matches — You won!` : `${matches} match${matches !== 1 ? "es" : ""} — No prize`}
                </div>
              </div>
            ) : (
              // Real bets: resolve_bet decides the draw server-side and only
              // returns the payout, not the drawn numbers — no ball reveal.
              <div className="space-y-2">
                <div className="flex justify-center gap-2 flex-wrap">
                  {picked.map((n) => (
                    <div key={n} className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border bg-primary/20 text-primary border-primary/50">
                      {n}
                    </div>
                  ))}
                </div>
                <div className={cn("text-sm font-bold", matches >= 3 ? "text-primary" : "text-muted-foreground")}>
                  {matches === 6 ? t("games.jackpot") : matches >= 3 ? `${matches} matches — You won!` : t("games.noPrizeThisTime2")}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prize table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-xs font-bold">{t("games.prizeTable")}</div>
        <div className="divide-y divide-border">
          {PRIZE_TABLE.map(p => (
            <div key={p.match} className="flex items-center justify-between px-4 py-2.5">
              <div className="text-xs text-muted-foreground">{p.match} {t("games.numbersMatched")}</div>
              <div className={cn("text-xs font-black font-mono", p.color)}>{fmt(p.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full font-bold text-base py-6" onClick={playLotto} disabled={picked.length < LOTTO_PICK || animating}>
        <Ticket size={16} className="mr-2" />
        {t("games.playTicket")} {fmt(TICKET_COST)}
      </Button>

      <p className="text-[10px] text-center text-muted-foreground">
        {t("games.10OfEveryTicket")} <span className="text-primary font-semibold">{t("games.payrusCommunityInvestmentFund")}</span>
      </p>
    </div>
  );
}

// ─── SPORTS SECTION ───────────────────────────────────────────────────────────

type Outcome = "home" | "draw" | "away";

interface Bet {
  matchId: number;
  outcome: Outcome;
  odds: number;
  home: string;
  away: string;
}

function SportsSection({ gameBalance, onDeduct, onCredit, isReal, currentUserId, currency, placeBet: placeBetReal, resolveBet }: {
  gameBalance: number;
  onDeduct: (n: number) => void;
  onCredit: (n: number) => void;
} & RealMoneyProps) {
  const { t } = useTranslation("common");
  const [betSlip, setBetSlip] = useState<Bet[]>([]);
  const [stake, setStake] = useState("1000");
  const [sport, setSport] = useState<"football" | "basketball">("football");
  const [resolved, setResolved] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [placing, setPlacing] = useState(false);

  const matches = sport === "football" ? FOOTBALL_MATCHES : BASKETBALL_MATCHES;

  const totalOdds = betSlip.reduce((acc, b) => acc * b.odds, 1);
  const stakeNum = Number(stake) || 0;
  const potentialWin = Math.round(stakeNum * totalOdds);

  function toggleBet(matchId: number, outcome: Outcome, odds: number, home: string, away: string) {
    setBetSlip(prev => {
      const existing = prev.find(b => b.matchId === matchId);
      if (existing?.outcome === outcome) return prev.filter(b => b.matchId !== matchId);
      const filtered = prev.filter(b => b.matchId !== matchId);
      return [...filtered, { matchId, outcome, odds, home, away }];
    });
  }

  async function submitBetReal() {
    if (!currentUserId) return;
    setPlacing(true);
    setResolved(false);
    try {
      const bet = await placeBetReal({ userId: currentUserId, kind: "sports", stakeAmount: stakeNum, currency, meta: { odds: totalOdds } });
      await new Promise((r) => setTimeout(r, 1800));
      const result = await resolveBet({ betId: bet.id, userId: currentUserId });
      if (result.status === "won") {
        const payout = result.payoutAmount ?? 0;
        setWinAmount(payout);
        toast.success(`🏆 All predictions correct! Won ${fmt(payout)}!`);
      } else {
        setWinAmount(0);
        toast.info(t("games.somePredictionsWereWrong"));
      }
      setResolved(true);
      setBetSlip([]);
    } catch {
      toast.error(t("games.couldnTPlaceThe"));
    } finally {
      setPlacing(false);
    }
  }

  function submitBet() {
    if (betSlip.length === 0) { toast.error(t("games.addAtLeastOne")); return; }
    if (stakeNum < 500) { toast.error(t("games.minimumStake500Xaf")); return; }
    if (isReal) {
      void submitBetReal();
      return;
    }
    if (gameBalance < stakeNum) { toast.error(t("games.insufficientGameWalletBalance2")); return; }
    onDeduct(stakeNum);
    setResolved(false);
    setTimeout(() => {
      // ~35% win rate for demo
      const win = Math.random() < 0.35;
      if (win) {
        onCredit(potentialWin);
        setWinAmount(potentialWin);
        toast.success(`🏆 All predictions correct! Won ${fmt(potentialWin)}!`);
      } else {
        setWinAmount(0);
        toast.info(t("games.somePredictionsWereWrong"));
      }
      setResolved(true);
      setBetSlip([]);
    }, 1800);
  }

  return (
    <div className="space-y-4">
      {/* Sport selector */}
      <div className="flex gap-2">
        {(["football", "basketball"] as const).map(s => (
          <button key={s} onClick={() => setSport(s)}
            className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold border capitalize transition-colors cursor-pointer",
              sport === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
            {s === "football" ? t("games.football") : t("games.basketball")}
          </button>
        ))}
      </div>

      {/* Match list */}
      <div className="space-y-2">
        {matches.map(m => {
          const betOnMatch = betSlip.find(b => b.matchId === m.id);
          return (
            <div key={m.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{m.home} <span className="text-muted-foreground font-normal">{t("games.vs")}</span> {m.away}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                    <span>{m.league}</span>
                    <span className="flex items-center gap-1"><Clock size={9} />{m.time}</span>
                  </div>
                </div>
                {betOnMatch && <span className="text-[9px] font-black bg-primary/15 border border-primary/30 text-primary px-2 py-0.5 rounded-full">{t("p2p.new.selected")}</span>}
              </div>
              <div className={cn("grid gap-2", m.drawOdds > 0 ? "grid-cols-3" : "grid-cols-2")}>
                {[
                  { outcome: "home" as Outcome, label: m.home.split(" ").slice(-1)[0], odds: m.homeOdds },
                  ...(m.drawOdds > 0 ? [{ outcome: "draw" as Outcome, label: "Draw", odds: m.drawOdds }] : []),
                  { outcome: "away" as Outcome, label: m.away.split(" ").slice(-1)[0], odds: m.awayOdds },
                ].map(opt => (
                  <button key={opt.outcome}
                    onClick={() => toggleBet(m.id, opt.outcome, opt.odds, m.home, m.away)}
                    className={cn(
                      "flex flex-col items-center py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer",
                      betOnMatch?.outcome === opt.outcome
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                    )}>
                    <span className="text-[10px] font-normal truncate max-w-full px-1">{t(opt.label)}</span>
                    <span className="text-base font-black">{opt.odds.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bet slip */}
      {betSlip.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3 sticky bottom-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{t("games.betSlip")} <span className="text-primary">{betSlip.length} {t("games.selection")}{betSlip.length > 1 ? "s" : ""}</span></span>
            <button onClick={() => setBetSlip([])} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14} /></button>
          </div>
          {betSlip.map(b => (
            <div key={b.matchId} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate flex-1">{b.home} {t("games.vs")} {b.away}</span>
              <span className="font-bold text-primary ml-2 shrink-0">{b.outcome === "draw" ? t("games.draw") : b.outcome === "home" ? t("shop.category.home") : t("games.away")} @ {b.odds.toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("games.combinedOdds")}</span>
              <span className="font-black text-foreground">{totalOdds.toFixed(2)}x</span>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">{t("games.stakeXafMin500")}</label>
              <Input type="number" value={stake} onChange={e => setStake(e.target.value)} className="font-mono" />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("games.potentialWin")}</span>
              <span className="font-black text-primary font-mono">{fmt(potentialWin)}</span>
            </div>
          </div>
          <Button className="w-full font-bold" onClick={submitBet} disabled={placing}>
            <Target size={14} className="mr-1.5" />
            {placing ? t("games.placing") : `Place Bet — ${fmt(stakeNum)}`}
          </Button>
        </motion.div>
      )}

      {resolved && winAmount === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">{t("games.keepPlayingEveryBet")}</div>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        {t("games.5OfAllStakes")} <span className="text-primary font-semibold">{t("games.payrusCommunityInvestmentFund")}</span>
      </p>
    </div>
  );
}

// ─── SCRATCH CARDS ────────────────────────────────────────────────────────────

interface ScratchCell {
  prize: number;
  revealed: boolean;
}

function ScratchSection({ gameBalance, onDeduct, onCredit, isReal, currentUserId, currency, placeBet, resolveBet }: {
  gameBalance: number;
  onDeduct: (n: number) => void;
  onCredit: (n: number) => void;
} & RealMoneyProps) {
  const { t } = useTranslation("common");
  const CARD_COST = 1000;
  const [cells, setCells] = useState<ScratchCell[] | null>(null);
  const [allRevealed, setAllRevealed] = useState(false);
  const [totalWon, setTotalWon] = useState<number | null>(null);
  const [jackpotPot, setJackpotPot] = useState(7840000);
  const [buying, setBuying] = useState(false);
  // Real cards are already settled server-side (resolveBet runs before the
  // card is even dealt) — revealing cells is a client-side animation over an
  // already-known result, so it must never credit the wallet a second time.
  const [isCardReal, setIsCardReal] = useState(false);

  async function buyCardReal() {
    if (!currentUserId) return;
    setBuying(true);
    try {
      const bet = await placeBet({ userId: currentUserId, kind: "scratch", stakeAmount: CARD_COST, currency });
      const resolved = await resolveBet({ betId: bet.id, userId: currentUserId });
      const payout = resolved.payoutAmount ?? 0;
      setJackpotPot(p => p + Math.round(CARD_COST * 0.1));
      const winIdx = Math.floor(Math.random() * 9);
      const prizes = Array.from({ length: 9 }, (_, i) => (i === winIdx ? payout : 0));
      setCells(prizes.map(p => ({ prize: p, revealed: false })));
      setAllRevealed(false);
      setTotalWon(null);
      setIsCardReal(true);
    } catch {
      toast.error(t("games.couldnTBuyThe"));
    } finally {
      setBuying(false);
    }
  }

  function buyCard() {
    if (isReal) {
      void buyCardReal();
      return;
    }
    if (gameBalance < CARD_COST) { toast.error(t("games.insufficientBalance")); return; }
    onDeduct(CARD_COST);
    setJackpotPot(p => p + Math.round(CARD_COST * 0.1));
    const prizes = [...SCRATCH_PRIZES].sort(() => Math.random() - 0.5).slice(0, 9);
    setCells(prizes.map(p => ({ prize: p, revealed: false })));
    setAllRevealed(false);
    setTotalWon(null);
    setIsCardReal(false);
  }

  function revealCell(i: number) {
    if (!cells || cells[i].revealed) return;
    const next = cells.map((c, idx) => idx === i ? { ...c, revealed: true } : c);
    setCells(next);
    if (next.every(c => c.revealed)) {
      const total = next.reduce((s, c) => s + c.prize, 0);
      setAllRevealed(true);
      setTotalWon(total);
      if (total > 0) {
        if (!isCardReal) onCredit(total);
        toast.success(`🎰 Scratch complete! You won ${fmt(total)}!`);
      } else {
        toast.info(t("games.noPrizeThisTime3"));
      }
    }
  }

  function revealAll() {
    if (!cells) return;
    const next = cells.map(c => ({ ...c, revealed: true }));
    setCells(next);
    const total = next.reduce((s, c) => s + c.prize, 0);
    setAllRevealed(true);
    setTotalWon(total);
    if (total > 0) {
      if (!isCardReal) onCredit(total);
      toast.success(`🎰 You won ${fmt(total)}!`);
    } else {
      toast.info(t("games.noPrizeThisTime4"));
    }
  }

  return (
    <div className="space-y-4">
      {/* Jackpot accumulator */}
      <div className="bg-gradient-to-br from-violet-900/40 to-violet-700/10 border border-violet-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
          <Trophy size={22} className="text-violet-700" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-violet-700 uppercase tracking-widest">{t("games.jackpotAccumulator")}</div>
          <div className="text-2xl font-black font-mono text-violet-300">{fmt(jackpotPot)}</div>
          <div className="text-[10px] text-muted-foreground">{t("games.growsWithEveryCard")}</div>
        </div>
      </div>

      {/* Card info */}
      {!cells && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Card cost", value: fmt(CARD_COST) },
              { label: "Top instant prize", value: fmt(50000) },
              { label: "Odds of winning", value: "1 in 4" },
              { label: "Community share", value: "10% of cards" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground">{t(s.label)}</div>
                <div className="font-black text-sm">{s.value}</div>
              </div>
            ))}
          </div>
          <Button className="w-full font-bold text-base py-6" onClick={buyCard} disabled={buying}>
            <Ticket size={16} className="mr-2" /> {buying ? t("games.buying") : `Buy Scratch Card — ${fmt(CARD_COST)}`}
          </Button>
        </div>
      )}

      {/* Active card */}
      {cells && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black">{t("games.scratchToReveal")}</span>
            {!allRevealed && (
              <button onClick={revealAll} className="text-xs text-primary font-semibold cursor-pointer hover:underline">{t("games.revealAll")}</button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {cells.map((cell, i) => (
              <motion.button
                key={i}
                onClick={() => revealCell(i)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all",
                  cell.revealed
                    ? cell.prize > 0
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-secondary border-border text-muted-foreground"
                    : "bg-gradient-to-br from-violet-800/40 to-violet-600/20 border-violet-200 hover:border-violet-200"
                )}
              >
                {cell.revealed ? (
                  <>
                    {cell.prize > 0
                      ? <><Star size={18} className="text-primary" /><span className="text-xs font-black font-mono">{fmt(cell.prize)}</span></>
                      : <><X size={18} /><span className="text-xs text-muted-foreground">0</span></>
                    }
                  </>
                ) : (
                  <div className="text-2xl">🎰</div>
                )}
              </motion.button>
            ))}
          </div>

          {allRevealed && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn("rounded-xl p-4 text-center", totalWon! > 0 ? "bg-primary/10 border border-primary/30" : "bg-secondary border border-border")}>
              {totalWon! > 0 ? (
                <>
                  <CheckCircle size={28} className="text-primary mx-auto mb-1" />
                  <div className="font-black text-lg text-primary">{fmt(totalWon!)}</div>
                  <div className="text-xs text-muted-foreground">{t("games.creditedToYourGame")}</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">{t("games.noPrizeTryAnother")}</div>
              )}
            </motion.div>
          )}

          {allRevealed && (
            <Button variant="secondary" className="w-full" onClick={buyCard}>
              <RotateCcw size={14} className="mr-1.5" /> {t("games.tryAnotherCard")}
            </Button>
          )}
        </motion.div>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        {t("games.10OfEveryCard")} <span className="text-primary font-semibold">{t("games.payrusCommunityInvestmentFund")}</span>
      </p>
    </div>
  );
}

// ─── GAME WALLET ─────────────────────────────────────────────────────────────

function GameWallet({ balance, onTopUp, onWithdraw }: {
  balance: number;
  onTopUp: (n: number) => void;
  onWithdraw: (n: number) => void;
}) {
  const { t } = useTranslation("common");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const PRESETS = [1000, 2000, 5000, 10000, 25000];
  const communityFund = 12840000;

  function handleTopUp() {
    const n = Number(topUpAmount);
    if (!n || n < 500) { toast.error(t("games.minimumTopUp500")); return; }
    onTopUp(n);
    setTopUpAmount("");
    toast.success(`${fmt(n)} added to game wallet`);
  }

  function handleWithdraw() {
    const n = Number(withdrawAmount);
    if (!n || n < 500) { toast.error(t("games.minimumWithdrawal500Xaf")); return; }
    if (n > balance) { toast.error(t("games.insufficientGameWalletBalance2")); return; }
    onWithdraw(n);
    setWithdrawAmount("");
    toast.success(`${fmt(n)} returned to main balance`);
  }

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-primary/20 to-emerald-900/20 border border-primary/30 rounded-2xl p-5 text-center space-y-1">
        <div className="text-[11px] font-bold text-primary uppercase tracking-widest">{t("games.gameWallet")}</div>
        <div className="text-4xl font-black font-mono">{fmt(balance)}</div>
        <div className="text-xs text-muted-foreground">{t("games.availableToPlay")}</div>
      </div>

      {/* Top up */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="font-bold text-sm">{t("games.topUpFromMain")}</div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setTopUpAmount(String(p))}
              className={cn("text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                topUpAmount === String(p) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
              {p.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input type="number" placeholder={t("games.amountXaf")} value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} className="font-mono" />
          <Button onClick={handleTopUp} className="shrink-0 font-bold"><Plus size={15} /></Button>
        </div>
      </div>

      {/* Withdraw */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="font-bold text-sm">{t("games.withdrawWinnings")}</div>
        <div className="flex gap-2">
          <Input type="number" placeholder={t("games.amountXaf")} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="font-mono" />
          <Button variant="secondary" onClick={handleWithdraw} className="shrink-0 font-bold"><Minus size={15} /></Button>
        </div>
        <p className="text-[10px] text-muted-foreground">{t("games.winningsAreDepositedInstantly")}</p>
      </div>

      {/* Community fund */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" />
          <span className="font-bold text-sm">{t("games.communityInvestmentFund")}</span>
        </div>
        <div className="text-2xl font-black font-mono text-primary">{fmt(communityFund)}</div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <Trans i18nKey="games.communityFundNote" components={{ b: <span className="text-foreground font-semibold" /> }} />
        </p>
        <div className="flex gap-2">
          {[
            { label: "Ventures backed", value: "14" },
            { label: "Players contributing", value: "8,420" },
            { label: "Fund growth / mo", value: "+12%" },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-secondary/50 border border-border rounded-xl px-2 py-2 text-center">
              <div className="font-black text-sm text-primary">{s.value}</div>
              <div className="text-[9px] text-muted-foreground">{t(s.label)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Signed-in users bet directly against their real PayRus wallet — there's no
// separate game-wallet balance to top up or withdraw from anymore.
function RealGameWallet({ balance, currency }: { balance: number | undefined; currency: string }) {
  const { t } = useTranslation("common");
  const communityFund = 12840000;
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-primary/20 to-emerald-900/20 border border-primary/30 rounded-2xl p-5 text-center space-y-1">
        <div className="text-[11px] font-bold text-primary uppercase tracking-widest">{t("games.payrusBalance")}</div>
        <div className="text-4xl font-black font-mono">{balance === undefined ? "—" : `${currency} ${balance.toLocaleString()}`}</div>
        <div className="text-xs text-muted-foreground">{t("games.betsDebitAndPayouts")}</div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
        <Wallet size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("games.thereSNoSeparate")}
        </p>
      </div>

      {/* Community fund */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" />
          <span className="font-bold text-sm">{t("games.communityInvestmentFund")}</span>
        </div>
        <div className="text-2xl font-black font-mono text-primary">{fmt(communityFund)}</div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <Trans i18nKey="games.communityFundNote" components={{ b: <span className="text-foreground font-semibold" /> }} />
        </p>
        <div className="flex gap-2">
          {[
            { label: "Ventures backed", value: "14" },
            { label: "Players contributing", value: "8,420" },
            { label: "Fund growth / mo", value: "+12%" },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-secondary/50 border border-border rounded-xl px-2 py-2 text-center">
              <div className="font-black text-sm text-primary">{s.value}</div>
              <div className="text-[9px] text-muted-foreground">{t(s.label)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RESPONSIBLE GAMING ───────────────────────────────────────────────────────

function ResponsibleGaming() {
  const { t } = useTranslation("common");
  const [dailyLimit, setDailyLimit] = useState("5000");
  const [selfExcluded, setSelfExcluded] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [limitSaved, setLimitSaved] = useState(false);

  function saveLimit() {
    if (!dailyLimit || Number(dailyLimit) < 500) { toast.error(t("games.minimumDailyLimit500")); return; }
    setLimitSaved(true);
    toast.success(`Daily limit set to ${fmt(Number(dailyLimit))}`);
    setTimeout(() => setLimitSaved(false), 3000);
  }

  function handleExclude(days: number) {
    setSelfExcluded(true);
    setCooldown(days);
    toast.success(`Self-exclusion activated for ${days} day${days > 1 ? "s" : ""}`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
        <Shield size={18} className="text-primary shrink-0" />
        <div>
          <div className="font-bold text-sm">{t("games.responsibleGaming")}</div>
          <div className="text-xs text-muted-foreground">{t("games.payrusIsCommittedTo")}</div>
        </div>
      </div>

      {/* Daily limit */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="font-bold text-sm">{t("games.dailySpendingLimit")}</div>
        <p className="text-xs text-muted-foreground">{t("games.setTheMaximumYou")}</p>
        <div className="flex gap-2 flex-wrap">
          {[1000, 2000, 5000, 10000].map(p => (
            <button key={p} onClick={() => setDailyLimit(String(p))}
              className={cn("text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                dailyLimit === String(p) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
              {p.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input type="number" placeholder={t("games.customLimitXaf")} value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} className="font-mono" />
          <Button onClick={saveLimit} className="shrink-0 font-bold">
            {limitSaved ? <CheckCircle size={15} /> : t("modules.save")}
          </Button>
        </div>
      </div>

      {/* Self-exclusion */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart size={15} className="text-rose-700" />
          <span className="font-bold text-sm">{t("games.selfExclusion")}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("games.ifYouFeelGaming")}
        </p>
        {selfExcluded ? (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            <AlertTriangle size={14} />
            {t("games.selfExclusionActive", { count: cooldown })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[1, 7, 30].map(days => (
              <button key={days} onClick={() => handleExclude(days)}
                className="py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-bold cursor-pointer hover:bg-destructive/10 transition-colors">
                {days === 1 ? t("games.1Day") : days === 7 ? t("games.1Week") : t("games.30Days")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="font-bold text-sm">{t("games.thisMonthSActivity")}</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Spent", value: fmt(8500), color: "text-muted-foreground" },
            { label: "Won", value: fmt(3200), color: "text-primary" },
            { label: "Net", value: fmt(-5300), color: "text-destructive" },
          ].map(s => (
            <div key={s.label} className="bg-secondary/50 border border-border rounded-xl px-2 py-2 text-center">
              <div className={cn("font-black text-sm font-mono", s.color)}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground">{t(s.label)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Help */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <Trans i18nKey="games.needHelp" values={{ helpline: t("games.freeProblemGamblingHelpline") }} components={{ b: <span className="text-foreground font-semibold" /> }} />
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function GamesPage() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<GameTab>("lotto");
  const [gameBalance, setGameBalance] = useState(5000); // XAF in game wallet — anonymous/demo play only

  const { profile } = useProfile();
  const currency = profile?.currency ?? "XAF";
  const currentUser = useCurrentAppUser();
  const realWallets = useWalletViewsForUser(currentUser?.id);
  const realBalance = (realWallets?.find(w => w.currency === currency) ?? realWallets?.[0])?.balance;
  const placeBetMutation = usePlaceBetMutation();
  const resolveBetMutation = useResolveBetMutation();

  // Signed in = real money mode: bets debit/credit the real wallet directly
  // (see RealMoneyProps above). Anonymous visitors keep the exact previous
  // play-money simulation via gameBalance/deduct/credit.
  const isReal = !!currentUser;
  const realMoneyProps = { isReal, currentUserId: currentUser?.id, currency, placeBet: placeBetMutation, resolveBet: resolveBetMutation };

  const TABS: { key: GameTab; label: string; icon: React.ElementType }[] = [
    { key: "lotto", label: t("games.tabLotto"), icon: Ticket },
    { key: "sports", label: t("games.tabSports"), icon: Flame },
    { key: "scratch", label: t("games.tabScratch"), icon: Star },
    { key: "wallet", label: t("games.tabWallet"), icon: Wallet },
    { key: "responsible", label: t("games.tabSafePlay"), icon: Shield },
  ];

  function deduct(n: number) { setGameBalance(prev => Math.max(0, prev - n)); }
  function credit(n: number) { setGameBalance(prev => prev + n); }
  function topUp(n: number) { setGameBalance(prev => prev + n); }
  function withdraw(n: number) { setGameBalance(prev => Math.max(0, prev - n)); }

  return (
    <div className="flex flex-col h-full">
      {/* Back navigation */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <PageHeader title={t("games.title")} className="mb-4 md:mb-6" />
      </div>
      {/* Header */}
      <div className="px-5 pt-0 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black">{t("nav.games")}</h1>
              <span className="text-[9px] font-black bg-primary/15 border border-primary/30 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t("games.title")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("games.gamesSportsPredictionsInstant")}</p>
          </div>
          {/* Wallet quick view */}
          <button onClick={() => setTab("wallet")}
            className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 cursor-pointer hover:bg-primary/15 transition-colors">
            <Wallet size={12} className="text-primary" />
            <span className="text-xs font-black text-primary font-mono">
              {isReal ? (realBalance === undefined ? "—" : `${currency} ${realBalance.toLocaleString()}`) : fmt(gameBalance)}
            </span>
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex gap-3 mt-3 mb-4">
          {[
            { label: isReal ? "PayRus balance" : "Game wallet", value: isReal ? (realBalance === undefined ? "—" : `${currency} ${realBalance.toLocaleString()}`) : fmt(gameBalance) },
            { label: "Community fund", value: `${formatCompact(12_800_000)} XAF` },
            { label: "Next lotto draw", value: "Wed 20:00" },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-secondary/50 border border-border rounded-xl px-2.5 py-2">
              <div className="text-[10px] text-muted-foreground">{t(s.label)}</div>
              <div className="font-black text-xs font-mono text-primary">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 overflow-x-auto border-b border-border pb-0">
          {TABS.map(tItem => (
            <button key={tItem.key} onClick={() => setTab(tItem.key)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3.5 py-2.5 border-b-2 transition-colors cursor-pointer shrink-0",
                tab === tItem.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              <tItem.icon size={12} />
              {t(tItem.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }} className="p-5">
            {tab === "lotto" && <LottoSection gameBalance={gameBalance} onDeduct={deduct} onCredit={credit} {...realMoneyProps} />}
            {tab === "sports" && <SportsSection gameBalance={gameBalance} onDeduct={deduct} onCredit={credit} {...realMoneyProps} />}
            {tab === "scratch" && <ScratchSection gameBalance={gameBalance} onDeduct={deduct} onCredit={credit} {...realMoneyProps} />}
            {tab === "wallet" && (isReal ? <RealGameWallet balance={realBalance} currency={currency} /> : <GameWallet balance={gameBalance} onTopUp={topUp} onWithdraw={withdraw} />)}
            {tab === "responsible" && <ResponsibleGaming />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
