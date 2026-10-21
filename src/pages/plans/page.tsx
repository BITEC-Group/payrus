import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Minus } from "lucide-react";
import PageHeader from "@/components/ui/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useMyPlans, usePlans, useSetMyPlan } from "@/hooks/use-institutional-team.ts";
import type { AccountPlan } from "@/lib/institutional-team.ts";

type Entitlement = { key: string; label: string };
const PERSON_ROWS: Entitlement[] = [
  { key: "p2p_free_monthly", label: "Free transfers per month" },
  { key: "fx_free_monthly_eur", label: "Free currency exchange per month (EUR)" },
  { key: "virtual_cards_max", label: "Virtual cards" },
  { key: "physical_cards_max", label: "Physical cards" },
  { key: "savings_pots_max", label: "Savings pots" },
  { key: "support", label: "Support" },
];
const BUSINESS_ROWS: Entitlement[] = [
  { key: "team_members_max", label: "Team members" },
  { key: "local_transfers_free_monthly", label: "Free local transfers per month" },
  { key: "fx_free_monthly_eur", label: "Free currency exchange per month (EUR)" },
  { key: "approval_chain_max", label: "Approvers in one approval chain" },
  { key: "webhooks_max", label: "Webhooks" },
  { key: "bulk_payments", label: "Bulk payments" },
  { key: "api_access", label: "API access" },
  { key: "dedicated_manager", label: "Dedicated relationship manager" },
  { key: "support", label: "Support" },
];

function Value({ v }: { v: number | boolean | string | undefined }) {
  const { t } = useTranslation("common");
  if (v === undefined) return <Minus size={14} className="text-muted-foreground" />;
  if (v === true) return <CheckCircle2 size={15} className="text-primary" />;
  if (v === false) return <Minus size={14} className="text-muted-foreground" />;
  if (v === -1) return <span>{t("plans.unlimited", "Unlimited")}</span>;
  return <span>{typeof v === "number" ? v.toLocaleString() : t(`plans.value.${v}`, { defaultValue: String(v) })}</span>;
}

function PlanGrid({ plans, rows, currentSlug, canChange, busy, onChoose }: {
  plans: AccountPlan[]; rows: Entitlement[]; currentSlug: string | null; canChange: boolean; busy: boolean; onChoose: (slug: string) => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${plans.length > 3 ? 11 : 12}rem, 1fr))` }}>
      {plans.map((p) => {
        const mine = p.slug === currentSlug;
        return (
          <div key={p.slug} className={cn("rounded-xl border p-4 flex flex-col gap-3 bg-card min-w-0", mine ? "border-primary ring-1 ring-primary" : "border-border")}>
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{t(p.label)}</h3>
                {mine && <span className="text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">{t("plans.current", "Current")}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t(p.tagline)}</p>
              <p className="mt-2 text-lg font-semibold">
                {p.monthlyFeeEur === null ? t("plans.onRequest", "On request") : p.monthlyFeeEur === 0 ? t("plans.free", "Free") : `€${p.monthlyFeeEur.toFixed(2)}`}
                {p.monthlyFeeEur ? <span className="text-xs font-normal text-muted-foreground"> /{t("plans.month", "month")}</span> : null}
              </p>
            </div>
            <ul className="space-y-1.5 text-xs">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t(r.label)}</span>
                  <span className="font-medium shrink-0"><Value v={p.entitlements[r.key]} /></span>
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              {mine ? null : p.slug === "enterprise"
                ? <p className="text-xs text-muted-foreground">{t("plans.contact", "Arranged with your relationship manager.")}</p>
                : <Button size="sm" variant="outline" className="w-full" disabled={!canChange || busy} onClick={() => onChoose(p.slug)}>{t("plans.choose", "Switch to {{plan}}", { plan: t(p.label) })}</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PlansPage() {
  const { t } = useTranslation("common");
  const user = useCurrentAppUser();
  const plans = usePlans().data ?? [];
  const mine = useMyPlans(user?.id).data ?? [];
  const setPlan = useSetMyPlan();
  const person = mine.find((m) => m.family === "individual");
  const business = mine.find((m) => m.family !== "individual");

  async function choose(role: string, plan: string) {
    if (!user) return;
    try { await setPlan.mutateAsync({ userId: user.id, role, plan }); toast.success(t("plans.changed", "Plan updated")); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      <PageHeader title={t("plans.title", "Plans & limits")} subtitle={t("plans.subtitle", "What your account includes, for people and for businesses")} showBack={false} />
      <p className="text-xs text-muted-foreground">{t("plans.pilot", "Prices are indicative. During the pilot, plan changes are free and billing is not active; team size, webhooks and approval-chain length are enforced from the plan.")}</p>

      {(person || (!business && !person)) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("plans.forPeople", "For people")}</h2>
          <PlanGrid plans={plans.filter((p) => p.family === "individual")} rows={PERSON_ROWS} currentSlug={person?.plan ?? null} canChange={!!person} busy={setPlan.isPending} onChoose={(s) => person && void choose(person.role, s)} />
        </section>
      )}

      {(business || (!business && !person)) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("plans.forBusinesses", "For businesses and organisations")}</h2>
          <PlanGrid plans={plans.filter((p) => p.family === "business")} rows={BUSINESS_ROWS} currentSlug={business?.plan ?? null} canChange={!!business} busy={setPlan.isPending} onChoose={(s) => business && void choose(business.role, s)} />
        </section>
      )}
    </div>
  );
}
