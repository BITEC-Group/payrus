import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Plane, Hotel, Star, MapPin, Search, Calendar, Users, ArrowRight, ArrowUpRight, Shield, Zap, Heart,
  SlidersHorizontal, CheckCircle2, CreditCard, Sparkles, TrendingDown, Globe, Luggage, Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { PayRusLogo } from "@/pages/layout/AppLayout.tsx";
import { toast } from "sonner";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  useCurrenciesByCode, useFlights, useHotels, useToggleTravelFavoriteMutation, useTravelBookings, useTravelFavorites,
  useTravelInstallmentPlansForUser, useTravelReviews,
} from "@/hooks/use-backend.ts";
import type { AppFlight, AppHotel } from "@/lib/backend.ts";
import AmenityChip from "./amenity-chip.tsx";
import BookingDialog, { type TravelItem } from "./booking-dialog.tsx";
import HotelDetailsDialog from "./hotel-details-dialog.tsx";
import ReviewsSection, { StarsDisplay } from "./reviews-section.tsx";
import { BookingsTab, SavedTab } from "./bookings-tab.tsx";
import { PartnerBookingDialog, PartnerFlightSearch, PartnerHotelSearch, type PartnerOffer } from "./partner-offers.tsx";
import { addDaysISO, airportLabel, AIRPORTS, durationHours, formatMoney, nightsBetween, round2, todayISO } from "./travel-utils.ts";

type SearchTab = "flights" | "hotels" | "saved" | "bookings";
type SortKey = "default" | "price" | "duration" | "rating";

const inputClass = "w-full pl-8 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";

const matches = (text: string, query: string) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase());

export default function TravelPage() {
  const { t, i18n } = useTranslation("common");
  const currentUser = useCurrentAppUser();
  const userId = currentUser?.id;
  const today = todayISO();

  const flights = useFlights();
  const hotels = useHotels();
  const bookings = useTravelBookings(userId);
  const plans = useTravelInstallmentPlansForUser(userId);
  const favorites = useTravelFavorites(userId);
  const reviews = useTravelReviews(userId);
  const toggleFavorite = useToggleTravelFavoriteMutation();

  const [activeTab, setActiveTab] = useState<SearchTab>("flights");

  // Flight search
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [flightDate, setFlightDate] = useState(addDaysISO(today, 14));
  const [passengers, setPassengers] = useState(1);
  const [flightFilter, setFlightFilter] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [cabin, setCabin] = useState<"all" | "economy" | "business">("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  // Hotel search
  const [place, setPlace] = useState("");
  const [checkIn, setCheckIn] = useState(addDaysISO(today, 14));
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 17));
  const [hotelFilter, setHotelFilter] = useState(0);

  const [bookingFor, setBookingFor] = useState<{ item: TravelItem; installments: boolean } | null>(null);
  const [detailsHotel, setDetailsHotel] = useState<AppHotel | null>(null);
  const [partnerBooking, setPartnerBooking] = useState<PartnerOffer | null>(null);

  const nights = Math.max(nightsBetween(checkIn, checkOut), 1);
  const favoriteSet = useMemo(() => new Set(favorites ?? []), [favorites]);

  // Secondary price in XAF, the main currency of the customers this app is built for.
  const currencyCodes = useMemo(() => Array.from(new Set(["USD", "XAF", ...(flights ?? []).map((f) => f.currency), ...(hotels ?? []).map((h) => h.currency)])), [flights, hotels]);
  const rates = useCurrenciesByCode(currencyCodes);
  const toXaf = (amount: number, currency: string): number | null => {
    const from = rates?.find((r) => r.code === currency)?.ratePerUsd;
    const xaf = rates?.find((r) => r.code === "XAF")?.ratePerUsd;
    return from && xaf ? Math.round((amount / from) * xaf) : null;
  };

  const requireSignIn = () => { toast.error(t("travel.signInRequired")); };

  async function handleToggleFavorite(kind: "flight" | "hotel", id: string) {
    if (!userId) { requireSignIn(); return; }
    try {
      const nowFavorite = await toggleFavorite({ userId, kind, itemId: id });
      toast.success(nowFavorite ? t("travel.favorites.added") : t("travel.favorites.removed"));
    } catch {
      toast.error(t("travel.favorites.failed"));
    }
  }

  // ── Flights: search + filters ───────────────────────────────────────────────
  const shownFlights = useMemo((): AppFlight[] => {
    let list = (flights ?? []).filter((f) =>
      matches(`${f.origin} ${AIRPORTS[f.origin] ?? ""}`, origin) && matches(`${f.destination} ${AIRPORTS[f.destination] ?? ""}`, destination)
      && f.seatsLeft >= passengers);
    switch (flightFilter) {
      case 1: list = list.filter((f) => f.stops === 0); break;
      case 2: list = list.filter((f) => durationHours(f.duration) < 10); break;
      case 3: list = [...list].sort((a, b) => a.price - b.price); break;
      case 4: list = [...list].sort((a, b) => b.rating - a.rating); break;
      case 5: list = list.filter((f) => f.memberDiscountPercent >= 5); break;
      default: break;
    }
    if (cabin !== "all") list = list.filter((f) => f.class === cabin);
    if (maxPrice && Number(maxPrice) > 0) list = list.filter((f) => f.price <= Number(maxPrice));
    if (sort === "price") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "duration") list = [...list].sort((a, b) => durationHours(a.duration) - durationHours(b.duration));
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [flights, origin, destination, passengers, flightFilter, cabin, maxPrice, sort]);

  const shownHotels = useMemo((): AppHotel[] => {
    let list = (hotels ?? []).filter((h) => matches(`${h.name} ${h.location}`, place));
    switch (hotelFilter) {
      case 1: list = list.filter((h) => h.memberDiscountPercent > 0); break;
      case 2: list = list.filter((h) => h.stars >= 5); break;
      case 3: list = list.filter((h) => /business|affaires/i.test(h.category) || h.amenities.includes("conference")); break;
      case 4: list = list.filter((h) => h.pricePerNight < 150); break;
      case 5: list = list.filter((h) => h.amenities.includes("pool")); break;
      case 6: list = list.filter((h) => h.amenities.includes("spa")); break;
      default: break;
    }
    return list;
  }, [hotels, place, hotelFilter]);

  const flightItems = (flights ?? []).map((f) => ({ id: f.id, label: `${f.airline} · ${f.origin}→${f.destination}` }));
  const hotelItems = (hotels ?? []).map((h) => ({ id: h.id, label: h.name }));

  const openFlightBooking = (flight: AppFlight, installments: boolean) =>
    setBookingFor({ item: { kind: "flight", flight }, installments });
  const openHotelBooking = (hotel: AppHotel, installments = false) => {
    setDetailsHotel(null);
    setBookingFor({ item: { kind: "hotel", hotel }, installments });
  };

  const tabs: { id: SearchTab; label: string; icon: typeof Plane }[] = [
    { id: "flights", label: t("travel.tabFlights"), icon: Plane },
    { id: "hotels", label: t("travel.tabHotels"), icon: Hotel },
    ...(currentUser ? [
      { id: "saved" as const, label: t("travel.tabSaved"), icon: Bookmark },
      { id: "bookings" as const, label: t("travel.tabBookings"), icon: CreditCard },
    ] : []),
  ];

  const loading = flights === undefined || hotels === undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-0 shrink-0">
        <PageHeader title={t("travel.title")} className="mb-4 md:mb-6" />
      </div>

      {/* ── Header ── */}
      <div className="px-5 pt-0 pb-4 border-b border-border bg-sidebar/40 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Plane size={20} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">{t("travel.heading")}</h1>
                <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-full">{t("travel.payrusTravel")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t("travel.subheading")}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5">
            <div className="rounded-lg bg-white px-2 py-1"><PayRusLogo className="h-5 w-auto" /></div>
            <div>
              <div className="text-[10px] font-bold text-primary">{t("travel.memberBadge")}</div>
              <div className="text-[9px] text-muted-foreground">{t("travel.upTo18Discount")}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {[
            { icon: TrendingDown, text: t("travel.benefits.bestRates"), color: "text-primary" },
            { icon: CreditCard, text: t("travel.benefits.splitPaymentNoFees"), color: "text-blue-700" },
            { icon: Zap, text: t("travel.benefits.instantConfirmation"), color: "text-amber-700" },
            { icon: Shield, text: t("travel.benefits.buyerProtection"), color: "text-emerald-700" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border whitespace-nowrap shrink-0">
              <b.icon size={12} className={b.color} />
              <span className="text-[11px] text-muted-foreground">{b.text}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mt-3 overflow-x-auto" role="tablist">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap",
                activeTab === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
              <tab.icon size={15} />
              {tab.label}
              {tab.id === "saved" && favorites && favorites.length > 0 && <span className="text-[10px] font-bold bg-primary/15 text-primary rounded-full px-1.5">{favorites.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto pb-20 md:pb-0">
        <AnimatePresence mode="wait">

          {/* ── Flights ── */}
          {activeTab === "flights" && (
            <motion.div key="flights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="p-4 md:p-5 space-y-5 max-w-4xl mx-auto">

              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="flight-origin" list="airports" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t("travel.search.from")} aria-label={t("travel.search.from")} className={inputClass} />
                  </div>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                    <input id="flight-destination" list="airports" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t("travel.search.to")} aria-label={t("travel.search.to")} className={inputClass} />
                  </div>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="flight-date" type="date" min={today} value={flightDate} onChange={(e) => setFlightDate(e.target.value)} aria-label={t("travel.booking.departureDate")} className={inputClass} />
                  </div>
                  <button type="button" onClick={() => toast.success(t("travel.search.found", { count: shownFlights.length }))}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors">
                    <Search size={14} /> {t("travel.searchButton")}
                  </button>
                </div>
                <datalist id="airports">{Object.keys(AIRPORTS).map((code) => <option key={code} value={code}>{airportLabel(code)}</option>)}</datalist>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users size={11} />
                    <select id="flight-passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} aria-label={t("travel.booking.passengers")} className="bg-transparent text-[11px] cursor-pointer">
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t("travel.search.passengerCount", { count: n })}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Luggage size={11} /> {t("travel.baggageIncluded")}</div>
                  <button type="button" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced} className="flex items-center gap-1.5 text-[11px] text-primary hover:underline cursor-pointer">
                    <SlidersHorizontal size={11} /> {t("travel.advancedFilters")}
                  </button>
                  {(origin || destination) && (
                    <button type="button" onClick={() => { setOrigin(""); setDestination(""); }} className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">{t("travel.search.clear")}</button>
                  )}
                </div>
                {showAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border" data-testid="advanced-filters">
                    <label className="space-y-1"><span className="text-[11px] text-muted-foreground">{t("travel.advanced.maxPrice")}</span>
                      <input id="flight-max-price" type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder={t("travel.usd")} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm" /></label>
                    <label className="space-y-1"><span className="text-[11px] text-muted-foreground">{t("travel.advanced.cabin")}</span>
                      <select id="flight-cabin" value={cabin} onChange={(e) => setCabin(e.target.value as typeof cabin)} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm">
                        <option value="all">{t("travel.filters.all")}</option><option value="economy">{t("travel.classEconomy")}</option><option value="business">{t("travel.classBusiness")}</option>
                      </select></label>
                    <label className="space-y-1"><span className="text-[11px] text-muted-foreground">{t("travel.advanced.sortBy")}</span>
                      <select id="flight-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm">
                        <option value="default">{t("travel.advanced.sortDefault")}</option><option value="price">{t("travel.filters.cheapest")}</option>
                        <option value="duration">{t("travel.advanced.sortDuration")}</option><option value="rating">{t("travel.filters.topRated")}</option>
                      </select></label>
                  </div>
                )}
              </div>

              <PartnerFlightSearch origin={origin} destination={destination} date={flightDate} passengers={passengers} userId={userId} onBook={setPartnerBooking} />

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[t("travel.filters.all"), t("travel.filters.nonStop"), t("travel.filters.under10h"), t("travel.filters.cheapest"), t("travel.filters.topRated"), t("travel.filters.payrusDiscount")].map((f, i) => (
                  <button key={f} type="button" onClick={() => setFlightFilter(i)} aria-pressed={i === flightFilter}
                    className={cn("px-3 py-1.5 rounded-full text-[11px] font-medium border whitespace-nowrap shrink-0 cursor-pointer transition-colors",
                      i === flightFilter ? "bg-primary/15 text-primary border-primary/25" : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground")}>
                    {f}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-muted-foreground" aria-live="polite" data-testid="flight-count">{t("travel.search.resultCount", { count: shownFlights.length })}</div>

              <div className="space-y-3">
                {loading && <div className="text-center py-10 text-muted-foreground text-sm">{t("signin.checking")}</div>}
                {!loading && shownFlights.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm" data-testid="no-flights">{t("travel.search.noResults")}</div>}
                {shownFlights.map((flight, i) => {
                  const expanded = selectedFlightId === flight.id;
                  const memberPrice = round2(flight.price * (1 - flight.memberDiscountPercent / 100));
                  const xaf = flight.currency === "XAF" ? null : toXaf(flight.price, flight.currency);
                  return (
                    <motion.div key={flight.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} data-testid="flight-card"
                      className={cn("rounded-2xl bg-card border overflow-hidden transition-all group", expanded ? "border-primary/50 shadow-lg shadow-primary/5" : "border-border hover:border-primary/25")}>
                      <div className="p-4 cursor-pointer" onClick={() => setSelectedFlightId(expanded ? null : flight.id)} role="button" tabIndex={0} aria-expanded={expanded}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedFlightId(expanded ? null : flight.id); } }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xs font-black text-primary shrink-0">{flight.airlineCode}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">{flight.airline}</span>
                              {flight.stops === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{t("travel.direct")}</span>}
                              <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">{flight.class === "economy" ? t("travel.classEconomy") : t("travel.classBusiness")}</span>
                              {flight.seatsLeft <= 5 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">{t("travel.seatsRemaining", { count: flight.seatsLeft })}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <div className="text-xl font-black text-foreground font-mono">{flight.departure}</div>
                                <div className="text-[10px] text-muted-foreground font-medium">{flight.origin}</div>
                              </div>
                              <div className="flex-1 flex flex-col items-center gap-1">
                                <div className="text-[10px] text-muted-foreground">{flight.duration}</div>
                                <div className="relative w-full flex items-center">
                                  <div className="w-full h-px bg-border" />
                                  <Plane size={12} className="absolute left-1/2 -translate-x-1/2 -translate-y-px text-primary" />
                                </div>
                                <div className="text-[10px] text-muted-foreground">{flight.stops === 0 ? t("travel.nonStopLabel") : t("travel.stopsCount", { count: flight.stops })}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-black text-foreground font-mono">{flight.arrival}</div>
                                <div className="text-[10px] text-muted-foreground font-medium">{flight.destination}</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <button type="button" aria-pressed={favoriteSet.has(`flight:${flight.id}`)} aria-label={t("travel.favorites.toggle")}
                              onClick={(e) => { e.stopPropagation(); void handleToggleFavorite("flight", flight.id); }} className="cursor-pointer transition-colors">
                              <Heart size={15} className={favoriteSet.has(`flight:${flight.id}`) ? "text-red-400 fill-red-400" : "text-muted-foreground"} />
                            </button>
                            <div>
                              {flight.memberDiscountPercent > 0 && <div className="text-[10px] font-bold text-primary">{t("travel.membersDiscount", { pct: flight.memberDiscountPercent })}</div>}
                              <div className="text-xl font-black text-foreground font-mono">{formatMoney(flight.price, flight.currency, i18n.language)}</div>
                              {xaf !== null && <div className="text-[10px] text-muted-foreground">≈ {formatMoney(xaf, "XAF", i18n.language)}</div>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Star size={11} className="text-amber-400 fill-amber-400" />
                              <span className="text-[11px] font-semibold text-foreground">{flight.rating}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">{flight.amenities.map((a) => <AmenityChip key={a} amenity={a} />)}</div>
                      </div>

                      <AnimatePresence>
                        {expanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                              {flight.memberDiscountPercent > 0 && (
                                <div className="text-[11px] text-primary flex items-center gap-1.5"><CheckCircle2 size={11} /> {t("travel.memberPrice")} <span className="font-bold font-mono">{formatMoney(memberPrice, flight.currency, i18n.language)}</span> / {t("travel.booking.passenger")}</div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => openFlightBooking(flight, true)}
                                  className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary text-sm font-bold cursor-pointer hover:bg-primary/15 transition-colors">
                                  <CreditCard size={15} /> {t("travel.payInThreeButton")}
                                </button>
                                <button type="button" onClick={() => openFlightBooking(flight, false)}
                                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
                                  {t("travel.bookNowButton")} <ArrowRight size={14} />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Shield size={11} className="text-emerald-700" />{t("travel.freeRefundNotice")}</div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              <ReviewsSection kind="flight" reviews={reviews ?? []} items={flightItems} userId={userId} />
            </motion.div>
          )}

          {/* ── Hotels ── */}
          {activeTab === "hotels" && (
            <motion.div key="hotels" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="p-4 md:p-5 space-y-5 max-w-4xl mx-auto">

              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="hotel-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("travel.destinationPlaceholder")} aria-label={t("travel.destinationPlaceholder")} className={inputClass} />
                  </div>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="hotel-check-in" type="date" min={today} value={checkIn}
                      onChange={(e) => { setCheckIn(e.target.value); if (checkOut <= e.target.value) setCheckOut(addDaysISO(e.target.value, 1)); }}
                      aria-label={t("travel.checkInPlaceholder")} className={inputClass} />
                  </div>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="hotel-check-out" type="date" min={addDaysISO(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} aria-label={t("travel.checkOutPlaceholder")} className={inputClass} />
                  </div>
                  <button type="button" onClick={() => toast.success(t("travel.search.foundHotels", { count: shownHotels.length }))}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors">
                    <Search size={14} /> {t("travel.searchButton")}
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground mt-3" data-testid="nights-label">{t("travel.search.nightsLabel", { count: nights })}</div>
              </div>

              <PartnerHotelSearch place={place} checkIn={checkIn} checkOut={checkOut} userId={userId} onBook={setPartnerBooking} />

              <div className="rounded-2xl overflow-hidden border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2 shrink-0"><PayRusLogo className="h-6 w-auto" /></div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{t("travel.partnerHotelsTitle")}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t("travel.partnerHotelsPrefix")} <span className="text-primary font-semibold">{t("travel.partnerHotelsHighlight")}</span> {t("travel.partnerHotelsSuffix")}</div>
                  </div>
                  <Sparkles size={20} className="text-primary ml-auto shrink-0" />
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[t("travel.filters.all"), t("travel.filters.payrusPartners"), t("travel.filters.luxury5star"), t("travel.filters.business"), t("travel.filters.under150"), t("travel.filters.pool"), t("travel.filters.spa")].map((f, i) => (
                  <button key={f} type="button" onClick={() => setHotelFilter(i)} aria-pressed={i === hotelFilter}
                    className={cn("px-3 py-1.5 rounded-full text-[11px] font-medium border whitespace-nowrap shrink-0 cursor-pointer transition-colors",
                      i === hotelFilter ? "bg-primary/15 text-primary border-primary/25" : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground")}>
                    {f}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-muted-foreground" aria-live="polite" data-testid="hotel-count">{t("travel.search.resultCountHotels", { count: shownHotels.length })}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading && <div className="col-span-full text-center py-10 text-muted-foreground text-sm">{t("signin.checking")}</div>}
                {!loading && shownHotels.length === 0 && <div className="col-span-full text-center py-10 text-muted-foreground text-sm" data-testid="no-hotels">{t("travel.search.noResults")}</div>}
                {shownHotels.map((hotel, i) => {
                  const liked = favoriteSet.has(`hotel:${hotel.id}`);
                  const memberPrice = round2(hotel.pricePerNight * (1 - hotel.memberDiscountPercent / 100));
                  return (
                    <motion.div key={hotel.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} data-testid="hotel-card"
                      className="rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/25 transition-all group">
                      <div className="relative h-36 bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                        <span className="text-5xl" aria-hidden>{hotel.emoji}</span>
                        <button type="button" aria-pressed={liked} aria-label={t("travel.favorites.toggle")} onClick={() => void handleToggleFavorite("hotel", hotel.id)}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-card transition-colors">
                          <Heart size={14} className={liked ? "text-red-400 fill-red-400" : "text-muted-foreground"} />
                        </button>
                        {hotel.memberDiscountPercent > 0 && (
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/90 backdrop-blur-sm">
                            <div className="rounded px-1 bg-white"><PayRusLogo className="h-3 w-auto" /></div>
                            <span className="text-[10px] font-bold text-primary-foreground">-{hotel.memberDiscountPercent}%</span>
                          </div>
                        )}
                        <div className="absolute bottom-3 left-3"><StarsDisplay count={hotel.stars} /></div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground truncate">{hotel.name}</div>
                            <div className="flex items-center gap-1 mt-0.5"><MapPin size={10} className="text-muted-foreground shrink-0" /><span className="text-[11px] text-muted-foreground truncate">{hotel.location}</span></div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-black text-foreground font-mono">{formatMoney(hotel.pricePerNight, hotel.currency, i18n.language)}</div>
                            <div className="text-[10px] text-muted-foreground">{t("travel.perNight")}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200">
                            <Star size={10} className="text-amber-400 fill-amber-400" /><span className="text-[11px] font-bold text-amber-700">{hotel.rating}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{t("travel.reviewsCountLabel", { count: hotel.reviewCount.toLocaleString(i18n.language) })}</span>
                          {hotel.distance && <span className="text-[10px] text-muted-foreground">· {t(hotel.distance, { defaultValue: hotel.distance })}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                          {hotel.amenities.slice(0, 4).map((a) => <AmenityChip key={a} amenity={a} size={8} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[9px] text-muted-foreground border border-border" />)}
                          {hotel.amenities.length > 4 && <span className="text-[9px] text-muted-foreground">+{hotel.amenities.length - 4}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setDetailsHotel(hotel)}
                            className="py-2 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors flex items-center justify-center gap-1.5">
                            <Globe size={12} /> {t("travel.viewButton")}
                          </button>
                          <button type="button" onClick={() => openHotelBooking(hotel)}
                            className="py-2 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold cursor-pointer hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                            {t("travel.reserveButton")} <ArrowUpRight size={12} />
                          </button>
                        </div>
                        {hotel.memberDiscountPercent > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary">
                            <CheckCircle2 size={10} /> {t("travel.memberPrice")} <span className="font-bold font-mono">{formatMoney(memberPrice, hotel.currency, i18n.language)}/{t("travel.nightAbbrev")}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <ReviewsSection kind="hotel" reviews={reviews ?? []} items={hotelItems} userId={userId} />
            </motion.div>
          )}

          {/* ── Saved ── */}
          {activeTab === "saved" && currentUser && (
            <motion.div key="saved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="p-4 md:p-5 max-w-3xl mx-auto">
              <SavedTab flights={flights ?? []} hotels={hotels ?? []} favorites={favorites ?? []} onToggle={(k, id) => void handleToggleFavorite(k, id)}
                onBookFlight={(f) => openFlightBooking(f, false)} onViewHotel={setDetailsHotel} />
            </motion.div>
          )}

          {/* ── My bookings ── */}
          {activeTab === "bookings" && currentUser && (
            <motion.div key="bookings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="p-4 md:p-5 max-w-3xl mx-auto">
              <BookingsTab userId={currentUser.id} bookings={bookings} plans={plans} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {bookingFor && (
        <BookingDialog
          item={bookingFor.item} userId={userId} initialInstallments={bookingFor.installments}
          initialDate={bookingFor.item.kind === "flight" ? flightDate : checkIn}
          initialPassengers={bookingFor.item.kind === "flight" ? passengers : 1}
          initialNights={nights}
          onClose={() => setBookingFor(null)}
          onViewBookings={() => setActiveTab("bookings")}
        />
      )}
      {partnerBooking && (
        <PartnerBookingDialog item={partnerBooking} userId={userId} onClose={() => setPartnerBooking(null)} onViewBookings={() => setActiveTab("bookings")} />
      )}
      {detailsHotel && (
        <HotelDetailsDialog
          hotel={detailsHotel} reviews={reviews ?? []} liked={favoriteSet.has(`hotel:${detailsHotel.id}`)} nights={nights}
          onToggleLike={() => void handleToggleFavorite("hotel", detailsHotel.id)}
          onBook={() => openHotelBooking(detailsHotel)} onClose={() => setDetailsHotel(null)}
        />
      )}
    </div>
  );
}
