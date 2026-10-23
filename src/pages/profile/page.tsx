import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  ChevronRight, CheckCircle2, ArrowLeft, Shield,
  Phone, Upload, ScanFace, IdCard, RotateCw, FileText, Building2, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { api } from "@/convex/_generated/api.js";
import { submitKybParties } from "@/lib/backend.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp.tsx";
import { useProfile, type ProfileType, getDefaultProfile } from "@/contexts/profile-context.tsx";
import { applyRealName } from "@/lib/post-auth-routing.ts";
import { useSetMySubProfile, useSubProfiles } from "@/hooks/use-institutional.ts";
import { useAddressesForUser, useRoleDefinitions, useUpsertUserRoleMutation, useUserRolesForUser } from "@/hooks/use-backend.ts";

/* ─── Role icons (traced from the PayRus mobile artefact's icon sprite) ──── */
type IconProps = { size?: number; className?: string };
const iconBase = { viewBox: "0 0 256 256", fill: "none" as const };

const IconWallet = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <rect x="24" y="64" width="208" height="128" rx="16" fill="currentColor" opacity=".25" />
    <rect x="24" y="64" width="208" height="128" rx="16" fill="none" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
    <circle cx="188" cy="128" r="12" fill="currentColor" />
  </svg>
);
const IconCard = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <rect x="24" y="56" width="208" height="144" rx="16" fill="currentColor" opacity=".25" />
    <rect x="24" y="56" width="208" height="144" rx="16" fill="none" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
    <line x1="24" y1="100" x2="232" y2="100" stroke="currentColor" strokeWidth="16" />
    <rect x="160" y="148" width="44" height="18" rx="4" fill="currentColor" />
  </svg>
);
const IconPayout = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <rect x="24" y="72" width="208" height="112" rx="12" fill="currentColor" opacity=".25" />
    <rect x="24" y="72" width="208" height="112" rx="12" fill="none" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
    <circle cx="128" cy="128" r="28" fill="none" stroke="currentColor" strokeWidth="16" />
  </svg>
);
const IconChart = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <g fill="currentColor" opacity=".25">
      <rect x="56" y="144" width="40" height="64" /><rect x="108" y="96" width="40" height="112" /><rect x="160" y="56" width="40" height="152" />
    </g>
    <g fill="none" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round">
      <rect x="56" y="144" width="40" height="64" /><rect x="108" y="96" width="40" height="112" /><rect x="160" y="56" width="40" height="152" />
    </g>
  </svg>
);
const IconShield = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <path d="M128 24 216 56 V132 C216 190 128 232 128 232 S40 190 40 132 V56 Z" fill="currentColor" opacity=".25" />
    <path d="M128 24 216 56 V132 C216 190 128 232 128 232 S40 190 40 132 V56 Z" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="96 124 120 148 164 100" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconRequest = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <circle cx="128" cy="128" r="96" fill="currentColor" opacity=".25" />
    <line x1="184" y1="72" x2="72" y2="184" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="136 184 72 184 72 120" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconDots = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <circle cx="128" cy="128" r="96" fill="currentColor" opacity=".25" />
    <circle cx="64" cy="128" r="16" fill="currentColor" /><circle cx="128" cy="128" r="16" fill="currentColor" /><circle cx="192" cy="128" r="16" fill="currentColor" />
  </svg>
);
const IconQuestion = ({ size = 26, className }: IconProps) => (
  <svg {...iconBase} width={size} height={size} className={className}>
    <circle cx="128" cy="128" r="96" fill="currentColor" opacity=".25" />
    <circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
    <line x1="128" y1="120" x2="128" y2="176" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
    <circle cx="128" cy="86" r="11" fill="currentColor" />
  </svg>
);

/* ─── Config ─────────────────────────────────────────────── */
interface ProfileTypeConfig {
  id: ProfileType;
  icon: React.ComponentType<IconProps>;
  features: string[];
}

const ROLES: ProfileTypeConfig[] = [
  { id: "personal", icon: IconWallet, features: ["profile.feat.personal_wallet", "profile.feat.mobile_money", "profile.feat.remittance", "profile.feat.fx_converter"] },
  { id: "merchant", icon: IconCard, features: ["profile.feat.pos_keypad", "profile.feat.payment_links", "profile.feat.invoicing", "profile.feat.bulk_payments"] },
  { id: "agent", icon: IconPayout, features: ["profile.feat.cash_in_out", "profile.feat.agent_network", "profile.feat.float_management", "profile.feat.commission_tracking"] },
  { id: "treasury", icon: IconChart, features: ["profile.feat.treasury", "profile.feat.api_access", "profile.feat.multi_currency", "profile.feat.two_sig_approvals"] },
  { id: "public_institution", icon: IconShield, features: ["profile.feat.sovereign_account", "profile.feat.tax_collection", "profile.feat.public_payroll", "profile.feat.audit_trail"] },
  { id: "ngo", icon: IconRequest, features: ["profile.feat.donor_payments", "profile.feat.grant_tracking", "profile.feat.beneficiary_payouts", "profile.feat.zero_fees"] },
  { id: "group", icon: IconDots, features: ["profile.feat.group_pot", "profile.feat.member_accounts", "profile.feat.savings_loans", "profile.feat.dividend_payments"] },
  { id: "starter", icon: IconQuestion, features: ["profile.feat.quick_setup", "profile.feat.basic_wallet", "profile.feat.mobile_money", "profile.feat.upgrade_anytime"] },
];

/* Flatten for lookups */
const ALL_PROFILES = ROLES;

type Step = "select" | "detail" | "verify" | "complete" | "chooseExisting";
const ID_TYPES = ["national", "passport", "voter"] as const;
type IdType = (typeof ID_TYPES)[number];

interface ExistingRole {
  id: string;
  role: string;
  kind: "individual" | "organisation";
  status: "incomplete" | "pending_verification" | "verified";
  complete: boolean;
  orgName?: string;
}

interface LocationState {
  existingUserId?: string;
  existingRoles?: ExistingRole[];
}

export default function ProfileSelection() {
  const { lng } = useParams<{ lng: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const { profile: activeProfile, setProfile } = useProfile();
  const locationState = (location.state ?? {}) as LocationState;

  const currentUser = useCurrentAppUser();
  const existingAddresses = useAddressesForUser(currentUser?.id);
  const upsertRole = useUpsertUserRoleMutation();
  const setSubProfileMutation = useSetMySubProfile();
  const allSubProfiles = useSubProfiles().data;
  // Convex file storage for the org registration document is kept
  // unchanged for now — it has no Supabase Storage equivalent in this pass
  // (see src/lib/backend.ts's note on this); the returned storage id is
  // persisted as an opaque reference string alongside everything else,
  // which now lives in Supabase.
  const generateDocUploadUrl = useMutation(api.userRoles.generateRegistrationDocUploadUrl);

  // Present when this page was reached from the sign-in existence check
  // (found-but-incomplete, found-with-multiple-roles, or not-found) rather
  // than the plain "Get started" preview path — this is what lets onboarding
  // write real, persisted roles instead of just a local preview profile.
  const [existingUserId] = useState<string | undefined>(locationState.existingUserId);
  const [existingRoles] = useState<ExistingRole[] | undefined>(locationState.existingRoles);

  // Reaching this page any other way (e.g. "Add another role" from an
  // already-logged-in session) carries no location.state at all — fall back
  // to the live session/roles so a returning user still gets the real,
  // persisted upsertRole path instead of the account-less preview one.
  const effectiveUserId = existingUserId ?? currentUser?.id;
  const liveRoles = useUserRolesForUser(!existingRoles && currentUser ? currentUser.id : undefined);
  const effectiveRoles = existingRoles ?? liveRoles;

  // The admin profile is unique: once verified as admin, every other role is
  // treated as already-activated (no re-running KYC per role) rather than
  // requiring a separate onboarding pass for each one.
  const isAdminUser = effectiveRoles?.some(r => (r.role === "admin" || r.role === "superadmin") && r.complete) ?? false;
  const roleLookup = (id: ProfileType): ExistingRole | undefined =>
    effectiveRoles?.find(r => r.role === id) ??
    (isAdminUser ? { id: "admin-virtual", role: id, kind: "individual", status: "verified", complete: true } : undefined);

  // Role list, order and individual/organisation kind come from the
  // role_definitions table; only icons and feature keys are presentation.
  const roleDefs = useRoleDefinitions();
  // Grouped like Revolut presents persons vs businesses: people first, then businesses, then institutions (family from migration 0059).
  const FAMILY_RANK: Record<string, number> = { individual: 0, business: 1, institution: 2 };
  const familyOf = (slug: string) => roleDefs?.find((d) => d.slug === slug)?.family ?? null;
  const orderedRoles = (roleDefs ?? [])
    .filter((d) => !d.isAdmin)
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (FAMILY_RANK[a.d.family ?? ""] ?? 9) - (FAMILY_RANK[b.d.family ?? ""] ?? 9) || a.i - b.i)
    .map(({ d }) => ROLES.find((r) => r.id === d.slug))
    .filter((r): r is ProfileTypeConfig => r != null);

  const [step, setStep] = useState<Step>(existingRoles && existingRoles.length > 1 ? "chooseExisting" : "select");
  const [selected, setSelected] = useState<ProfileType | null>(null);
  const [subProfile, setSubProfile] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  // Specialisations on offer for the chosen role (migration 0053). Only shown when
  // there is a real choice, so roles without sub-profiles see the wizard unchanged.
  const subProfileChoices = (allSubProfiles ?? []).filter((s) => s.parentRole === selected);
  const chosenSub = subProfileChoices.find((s) => s.slug === subProfile) ?? null;
  const isOrgRole = selected != null && roleDefs?.find((d) => d.slug === selected)?.kind === "organisation";

  // KYC/verification sub-wizard state (kept local to this page — mirrors the
  // registration flow's fields but runs after profile selection, since the
  // profile picked determines which verification tier applies).
  const [kycStep, setKycStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpResent, setOtpResent] = useState(false);
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState<IdType>("national");
  const [idFrontDocId, setIdFrontDocId] = useState<string | null>(null);
  const [uploadingIdFront, setUploadingIdFront] = useState(false);
  const [idBackDocId, setIdBackDocId] = useState<string | null>(null);
  const [uploadingIdBack, setUploadingIdBack] = useState(false);
  const [selfieDocId, setSelfieDocId] = useState<string | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Organisation-only onboarding fields — collected before KYC, registration
  // document first then the legal representative's identity, per the
  // requested order.
  const [registrationDocId, setRegistrationDocId] = useState<string | null>(null);
  const [registrationDocName, setRegistrationDocName] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [legalRepName, setLegalRepName] = useState("");
  const [legalRepIdType, setLegalRepIdType] = useState<IdType>("national");
  const [legalRepIdNumber, setLegalRepIdNumber] = useState("");
  const [legalRepPhone, setLegalRepPhone] = useState("");
  const [declaredOwners, setDeclaredOwners] = useState(1);
  const [owners, setOwners] = useState<{ name: string; pct: string }[]>([{ name: "", pct: "" }]);

  const selectedConfig = ALL_PROFILES.find(p => p.id === selected);
  const base = `/${lng ?? "en"}`;

  // A registered user already has phone/date-of-birth/address on file
  // (from registration, or an earlier role's KYC) — re-asking for them on
  // every new role would just recollect what PayRus already knows. Only
  // idType + the ID document + selfie are genuinely per-role proof of
  // identity, so those always stay in the wizard regardless.
  const knowsPhone = !!currentUser?.phone;
  const knowsDob = !!currentUser?.dateOfBirth;
  const knowsAddress = !!currentUser?.address || (existingAddresses?.length ?? 0) > 0;
  const formattedKnownAddress = currentUser?.address
    ?? (existingAddresses && existingAddresses[0]
      ? `${existingAddresses[0].houseNumber} ${existingAddresses[0].street}, ${existingAddresses[0].city}, ${existingAddresses[0].province}, ${existingAddresses[0].country}`
      : "");

  const handleUploadRegistrationDoc = async (file: File) => {
    setUploadingDoc(true);
    try {
      const uploadUrl = await generateDocUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await result.json();
      setRegistrationDocId(storageId);
      setRegistrationDocName(file.name);
    } catch {
      toast.error(t("profile.org.uploadFailed"));
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleUploadIdFront = async (file: File) => {
    setUploadingIdFront(true);
    try {
      const uploadUrl = await generateDocUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await result.json();
      setIdFrontDocId(storageId);
    } catch {
      toast.error(t("profile.org.uploadFailed"));
    } finally {
      setUploadingIdFront(false);
    }
  };

  const handleUploadIdBack = async (file: File) => {
    setUploadingIdBack(true);
    try {
      const uploadUrl = await generateDocUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await result.json();
      setIdBackDocId(storageId);
    } catch {
      toast.error(t("profile.org.uploadFailed"));
    } finally {
      setUploadingIdBack(false);
    }
  };

  const handleUploadSelfie = async (file: File) => {
    setUploadingSelfie(true);
    try {
      const uploadUrl = await generateDocUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await result.json();
      setSelfieDocId(storageId);
    } catch {
      toast.error(t("profile.org.uploadFailed"));
    } finally {
      setUploadingSelfie(false);
    }
  };

  // If this device has no local profile yet but the account already picked
  // one elsewhere (Convex is the source of truth), restore it instead of
  // asking again — keeps auth and profile selection in sync across devices.
  useEffect(() => {
    if (!activeProfile && currentUser?.profileType) {
      const restored = getDefaultProfile(currentUser.profileType as ProfileType);
      if (currentUser.name) restored.name = currentUser.name;
      setProfile(restored);
    }
  }, [activeProfile, currentUser?.profileType, currentUser?.name, setProfile]);

  const handleSelect = (id: ProfileType) => {
    const existing = roleLookup(id);
    if (existing?.complete) {
      // Already onboarded for this role — activate it instead of re-running
      // the whole KYC wizard from scratch.
      const profile = getDefaultProfile(id);
      applyRealName(profile, existing, currentUser?.name ?? undefined);
      setProfile(profile);
      navigate(base);
      return;
    }
    setSelected(id);
    setSubProfile(null);
    setStep("detail");
  };

  const handleConfirm = () => {
    if (!selected) return;
    setPhone(currentUser?.phone ?? "");
    setDob(currentUser?.dateOfBirth ?? "");
    setKycStep(0);
    setStep("verify");
  };

  const handleKycSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    const effectivePhone = knowsPhone ? (currentUser?.phone ?? "") : phone;
    const effectiveDob = knowsDob ? (currentUser?.dateOfBirth ?? "") : dob;
    const effectiveAddress = knowsAddress ? formattedKnownAddress : address;
    if (effectiveUserId) {
      // Real, persisted role — reached either from the sign-in existence
      // check, or from an already-logged-in session adding another role.
      try {
        const savedRoleId = await upsertRole({
          userId: effectiveUserId,
          role: selected,
          kind: isOrgRole ? "organisation" : "individual",
          phone: effectivePhone, dateOfBirth: effectiveDob, address: effectiveAddress, idType,
          idFrontDocPath: idFrontDocId ?? undefined,
          idBackDocPath: idBackDocId ?? undefined,
          selfieDocPath: selfieDocId ?? undefined,
          ...(isOrgRole ? {
            orgName: orgName.trim(),
            registrationDocPath: registrationDocId ?? undefined,
            legalRepName, legalRepIdType, legalRepIdNumber, legalRepPhone,
          } : {}),
        });
        if (isOrgRole && savedRoleId) {
          await submitKybParties({
            userId: effectiveUserId, roleId: savedRoleId, declaredOwners,
            parties: [
              ...owners.filter((o) => o.name.trim().length >= 2).map((o) => ({ type: "ubo" as const, name: o.name.trim(), ownershipPct: o.pct ? Number(o.pct) : undefined })),
              { type: "authorised_rep" as const, name: legalRepName.trim() },
            ],
          });
        }
        if (subProfile) {
          // Best effort: the role is already saved, and the specialisation can be changed later under Business modules.
          try { await setSubProfileMutation.mutateAsync({ userId: effectiveUserId, role: selected, subProfile }); }
          catch { toast.error(t("profile.subProfile.saveFailed", "Role saved, but the specialisation could not be saved. Choose it under Business modules.")); }
        }
      } catch {
        toast.error(t("profile.org.saveFailed"));
      }
    }
    // Else: "Get started" preview path — no real account behind it (no
    // effectiveUserId to persist against), so this activates the profile
    // locally only, same as it always has.
    const profile = getDefaultProfile(selected);
    if (orgName.trim() && selected !== "personal" && selected !== "starter") {
      profile.name = orgName.trim();
    } else if (currentUser?.name) {
      // A real account's own name always wins over the generic per-role
      // demo template (e.g. "Jean Dupont") — that template only exists for
      // the anonymous, account-less preview path.
      profile.name = currentUser.name;
    }
    setProfile(profile);
    setSubmitting(false);
    setStep("complete");
    if (!effectiveUserId) setTimeout(() => navigate(base), 1800);
  };

  // Steps are a data-driven list rather than hardcoded indices, since which
  // ones appear now depends on what PayRus already knows about this user —
  // an org role always prepends its two steps; phone/details drop out
  // individually once already on file.
  const needsDetailsStep = !knowsDob || !knowsAddress;
  type KycStepKey = "orgDoc" | "orgLegalRep" | "phone" | "details" | "id" | "selfie";
  const steps: KycStepKey[] = [
    ...(isOrgRole ? (["orgDoc", "orgLegalRep"] as const) : []),
    ...(knowsPhone ? [] : (["phone"] as const)),
    ...(needsDetailsStep ? (["details"] as const) : []),
    "id", "selfie",
  ];
  const kycTitles = steps.map(s => ({
    orgDoc: t("profile.org.titleDoc"),
    orgLegalRep: t("profile.org.titleLegalRep"),
    phone: t("profile.kyc.titlePhone"),
    details: t("profile.kyc.titleDetails"),
    id: t("profile.kyc.titleId"),
    selfie: t("profile.kyc.titleSelfie"),
  })[s]);
  const kycReady = steps.map(s => {
    switch (s) {
      case "orgDoc": return registrationDocId != null;
      case "orgLegalRep": return legalRepName.trim().length > 0 && legalRepIdNumber.trim().length > 0 && legalRepPhone.trim().length > 0 && owners.filter((o) => o.name.trim().length >= 2).length >= declaredOwners;
      case "phone": return phone.trim().length >= 6 && otp.trim().length === 6;
      case "details": return (knowsDob || dob.trim().length > 0) && (knowsAddress || address.trim().length > 0);
      case "id": return !!idFrontDocId && !!idBackDocId;
      case "selfie": return !!selfieDocId;
    }
  });
  const currentStepKey = steps[kycStep];

  return (
    <div className="min-h-full bg-background flex flex-col">
      <div className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className={cn("mx-auto px-4 py-8", step === "select" ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl")}>
          <AnimatePresence mode="wait">

            {/* ── Step 1: Select ── */}
            {step === "select" && (
              <motion.div key="select" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="space-y-6">
                <div className="space-y-1.5 lg:text-center">
                  <h1
                    className="text-[28px] leading-[1.1] tracking-tight text-foreground"
                    style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600 }}
                  >
                    {t("profile.selectTitle")}
                  </h1>
                  <p className="text-muted-foreground text-[14.5px] leading-relaxed lg:max-w-md lg:mx-auto">{t("profile.selectSub")}</p>
                </div>

                {/* Mobile & tablet: flat list rows, per the PayRus mobile artefact */}
                <div className="flex flex-col gap-2.5 lg:hidden">
                  {orderedRoles.map((pt, i) => {
                    const existing = roleLookup(pt.id);
                    return (
                    <motion.button
                      key={pt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleSelect(pt.id)}
                      className="flex items-center gap-3.5 rounded-sm bg-secondary/70 px-3.5 py-3.5 text-left cursor-pointer transition-colors hover:bg-secondary"
                    >
                      <pt.icon size={26} className="text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[17px] leading-tight text-foreground"
                          style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600 }}
                        >
                          {t(`profile.type.${pt.id}`)}
                        </div>
                        {familyOf(pt.id) && <div className="text-[10.5px] uppercase tracking-wide text-primary/80 mt-0.5">{t(`profile.family.${familyOf(pt.id)}`, familyOf(pt.id) === "individual" ? "For people" : familyOf(pt.id) === "business" ? "For businesses" : "For institutions")}</div>}
                        <div className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                          {existing ? (existing.complete ? t("profile.chooseRole.verified") : t("profile.chooseRole.incomplete")) : t(`profile.desc.${pt.id}`)}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </motion.button>
                    );
                  })}
                </div>

                {/* Desktop: same content, roomier editorial cards */}
                <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {orderedRoles.map((pt, i) => {
                    const existing = roleLookup(pt.id);
                    return (
                    <motion.button
                      key={pt.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleSelect(pt.id)}
                      className="relative text-left rounded-sm border border-border bg-card p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-center gap-3">
                        <pt.icon size={28} className="text-primary shrink-0" />
                        <div
                          className="text-lg leading-tight text-foreground"
                          style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600 }}
                        >
                          {t(`profile.type.${pt.id}`)}
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground shrink-0 ml-auto group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      {familyOf(pt.id) && <div className="text-[11px] uppercase tracking-wide text-primary/80 mt-2">{t(`profile.family.${familyOf(pt.id)}`, familyOf(pt.id) === "individual" ? "For people" : familyOf(pt.id) === "business" ? "For businesses" : "For institutions")}</div>}
                      <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {existing ? (existing.complete ? t("profile.chooseRole.verified") : t("profile.chooseRole.incomplete")) : t(`profile.desc.${pt.id}`)}
                      </div>
                    </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Details ── */}
            {step === "detail" && selectedConfig && (
              <motion.div key="detail" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="max-w-md mx-auto space-y-5">
                <button onClick={() => setStep("select")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-sm">
                  <ArrowLeft size={15} /> {t("profile.back")}
                </button>

                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-sm bg-secondary/70 mx-auto">
                    <selectedConfig.icon size={32} className="text-primary" />
                  </div>
                  <h2
                    className="text-xl text-foreground"
                    style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600 }}
                  >
                    {t(`profile.type.${selected}`)}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t(`profile.desc.${selected}`)}</p>
                </div>

                {/* Features list */}
                <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("profile.includes")}</div>
                  {selectedConfig.features.map(f => (
                    <div key={f} className="flex items-center gap-2.5">
                      <CheckCircle2 size={14} className="text-primary shrink-0" />
                      <span className="text-sm text-foreground">{t(f)}</span>
                    </div>
                  ))}
                </div>

                {/* Specialisation (optional): which kind of organisation this role is */}
                {subProfileChoices.length > 1 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("profile.subProfile.title", "What type of organisation?")}</div>
                    <div className="grid gap-2">
                      {subProfileChoices.map((s) => (
                        <button
                          key={s.slug}
                          type="button"
                          onClick={() => setSubProfile(subProfile === s.slug ? null : s.slug)}
                          className={cn(
                            "text-left rounded-xl border p-3 transition-colors cursor-pointer",
                            subProfile === s.slug ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{s.label}</span>
                            {subProfile === s.slug && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{t("profile.subProfile.optional", "Optional — you can choose or change this later under Business modules.")}</p>
                    {chosenSub && (
                      <div className="rounded-xl bg-card border border-border p-3 space-y-1.5">
                        {chosenSub.features.map((f) => (
                          <div key={f} className="flex items-center gap-2.5">
                            <CheckCircle2 size={14} className="text-primary shrink-0" />
                            <span className="text-sm text-foreground">{f}</span>
                          </div>
                        ))}
                        {chosenSub.enhancedKyc && (
                          <p className="text-xs text-amber-700 pt-1">{t("modules.enhancedKyc", "Enhanced KYC/AML/FATF verification · dedicated relationship manager")}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Special notice for treasury/institutional roles */}
                {(["treasury","public_institution","group"] as ProfileType[]).includes(selected!) && (
                  <div className="rounded-xl bg-accent/10 border border-accent/30 p-3 space-y-1">
                    <div className="text-xs font-semibold text-accent">
                      {t("profile.fiNotice.title")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("profile.fiNotice.body")}
                    </p>
                  </div>
                )}

                {/* Org name field */}
                {selected !== "personal" && selected !== "starter" && (
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground font-medium">{t("profile.orgName")}</label>
                    <div className="relative">
                      <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        placeholder={t("profile.orgNamePlaceholder")}
                        className="bg-card border-border pl-9"
                      />
                    </div>
                  </div>
                )}

                {/* KYC notice */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Shield size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{t("profile.kycNotice")}</p>
                </div>

                <Button onClick={handleConfirm} className="w-full h-12 text-base font-semibold rounded-xl">
                  {t("profile.activate")}
                </Button>
              </motion.div>
            )}

            {/* ── Step 3: Verify (KYC wizard) ── */}
            {step === "verify" && selectedConfig && (
              <motion.div key="verify" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="max-w-md mx-auto space-y-5">
                <button
                  onClick={() => (kycStep === 0 ? setStep("detail") : setKycStep(s => s - 1))}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-sm"
                >
                  <ArrowLeft size={15} /> {t("profile.kyc.back")}
                </button>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">{kycTitles[kycStep]}</h2>
                  <p className="text-sm text-muted-foreground">{t("profile.kyc.stepSub", { type: t(`profile.type.${selected}`) })}</p>
                  <Progress value={((kycStep + 1) / kycTitles.length) * 100} className="h-1.5" />
                  <div className="text-xs text-muted-foreground">{t("profile.kyc.progress", { step: kycStep + 1, total: kycTitles.length })}</div>
                </div>

                {kycStep === 0 && (knowsPhone || knowsDob || knowsAddress) && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <CheckCircle2 size={15} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">{t("profile.kyc.reusingKnownInfo")}</p>
                  </div>
                )}

                <div className="rounded-2xl bg-card border border-border p-4">
                  {currentStepKey === "orgDoc" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">{t("profile.org.docSub")}</p>
                      <label
                        className={cn(
                          "w-full flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors",
                          registrationDocId ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                        )}
                      >
                        {registrationDocId ? <CheckCircle2 size={26} className="text-primary" /> : <FileText size={26} className="text-muted-foreground" />}
                        <span className={cn("text-xs font-medium text-center px-2", registrationDocId ? "text-primary" : "text-muted-foreground")}>
                          {uploadingDoc ? t("profile.org.uploading") : registrationDocId ? registrationDocName : t("profile.org.uploadDoc")}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          disabled={uploadingDoc}
                          onChange={e => { const file = e.target.files?.[0]; if (file) void handleUploadRegistrationDoc(file); }}
                        />
                      </label>
                    </div>
                  )}

                  {currentStepKey === "orgLegalRep" && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">{t("profile.org.legalRepSub")}</p>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground font-medium">{t("profile.org.legalRepName")}</Label>
                        <div className="relative">
                          <UserCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input value={legalRepName} onChange={e => setLegalRepName(e.target.value)} className="bg-background border-border pl-9" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground font-medium">{t("profile.kyc.idTypeLabel")}</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {ID_TYPES.map(idt => (
                            <button
                              key={idt}
                              type="button"
                              onClick={() => setLegalRepIdType(idt)}
                              className={cn(
                                "text-xs font-semibold px-2 py-2.5 rounded-xl border transition-colors cursor-pointer",
                                legalRepIdType === idt ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {t(`profile.kyc.id${idt === "national" ? t("profile.national") : idt === "passport" ? t("profile.kyc.idPassport") : t("profile.voter")}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground font-medium">{t("profile.org.legalRepIdNumber")}</Label>
                        <Input value={legalRepIdNumber} onChange={e => setLegalRepIdNumber(e.target.value)} className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground font-medium">{t("profile.org.legalRepPhone")}</Label>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input value={legalRepPhone} onChange={e => setLegalRepPhone(e.target.value)} className="bg-background border-border pl-9" />
                        </div>
                      </div>
                      <div className="space-y-3 pt-2 border-t border-border">
                        <p className="text-sm font-semibold">{t("profile.org.ubo.title")}</p>
                        <p className="text-xs text-muted-foreground">{t("profile.org.ubo.sub")}</p>
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground font-medium">{t("profile.org.ubo.count")}</Label>
                          <Input type="number" min={1} max={20} value={declaredOwners} className="bg-background border-border w-28"
                            onChange={e => setDeclaredOwners(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
                        </div>
                        {owners.map((o, i) => (
                          <div key={i} className="flex gap-2">
                            <Input aria-label={t("profile.org.ubo.name")} placeholder={t("profile.org.ubo.name")} value={o.name} className="bg-background border-border flex-[2]"
                              onChange={e => setOwners(owners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                            <Input aria-label={t("profile.org.ubo.pct")} placeholder={t("profile.org.ubo.pct")} type="number" min={0} max={100} value={o.pct} className="bg-background border-border flex-1"
                              onChange={e => setOwners(owners.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} />
                          </div>
                        ))}
                        {owners.length < declaredOwners && (
                          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setOwners([...owners, { name: "", pct: "" }])}>{t("profile.org.ubo.add")}</Button>
                        )}
                      </div>
                    </div>
                  )}

                  {currentStepKey === "phone" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground font-medium">{t("profile.kyc.phoneLabel")}</Label>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder={t("profile.kyc.phonePlaceholder")}
                            className="bg-background border-border pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{t("profile.kyc.otpSent", { phone: phone || t("profile.kyc.phonePlaceholder") })}</p>
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                          </InputOTPGroup>
                        </InputOTP>
                        <button
                          type="button"
                          onClick={() => setOtpResent(true)}
                          className={cn("text-xs font-medium cursor-pointer", otpResent ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                        >
                          <RotateCw size={11} className="inline mr-1" />
                          {otpResent ? t("profile.kyc.codeResent") : t("profile.kyc.resendCode")}
                        </button>
                      </div>
                    </div>
                  )}

                  {currentStepKey === "details" && (
                    <div className="space-y-4">
                      {!knowsDob && (
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground font-medium">{t("profile.kyc.dobLabel")}</Label>
                          <Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="bg-background border-border" />
                        </div>
                      )}
                      {!knowsAddress && (
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground font-medium">{t("profile.kyc.addressLabel")}</Label>
                          <Input value={address} onChange={e => setAddress(e.target.value)} className="bg-background border-border" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground font-medium">{t("profile.kyc.idTypeLabel")}</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {ID_TYPES.map(idt => (
                            <button
                              key={idt}
                              type="button"
                              onClick={() => setIdType(idt)}
                              className={cn(
                                "text-xs font-semibold px-2 py-2.5 rounded-xl border transition-colors cursor-pointer",
                                idType === idt ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {t(`profile.kyc.id${idt === "national" ? t("profile.national") : idt === "passport" ? t("profile.kyc.idPassport") : t("profile.voter")}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStepKey === "id" && (
                    <div className="space-y-3">
                      <label
                        className={cn(
                          "w-full flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors",
                          idFrontDocId ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                        )}
                      >
                        {idFrontDocId ? <CheckCircle2 size={26} className="text-primary" /> : <IdCard size={26} className="text-muted-foreground" />}
                        <span className={cn("text-xs font-medium", idFrontDocId ? "text-primary" : "text-muted-foreground")}>
                          {uploadingIdFront ? t("profile.org.uploading") : idFrontDocId ? t("profile.kyc.uploadedFront") : t("profile.kyc.uploadFront")}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingIdFront}
                          onChange={e => { const file = e.target.files?.[0]; if (file) void handleUploadIdFront(file); }}
                        />
                      </label>
                      <label
                        className={cn(
                          "w-full flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors",
                          idBackDocId ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                        )}
                      >
                        {idBackDocId ? <CheckCircle2 size={26} className="text-primary" /> : <Upload size={26} className="text-muted-foreground" />}
                        <span className={cn("text-xs font-medium", idBackDocId ? "text-primary" : "text-muted-foreground")}>
                          {uploadingIdBack ? t("profile.org.uploading") : idBackDocId ? t("profile.kyc.uploadedBack") : t("profile.kyc.uploadBack")}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingIdBack}
                          onChange={e => { const file = e.target.files?.[0]; if (file) void handleUploadIdBack(file); }}
                        />
                      </label>
                    </div>
                  )}

                  {currentStepKey === "selfie" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="text-xs text-muted-foreground text-center max-w-xs">{t("profile.kyc.selfiePrompt")}</p>
                      <label
                        className={cn(
                          "w-36 h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors",
                          selfieDocId ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                        )}
                      >
                        {selfieDocId ? <CheckCircle2 size={30} className="text-primary" /> : <ScanFace size={30} className="text-muted-foreground" />}
                        <span className={cn("text-xs font-medium text-center px-2", selfieDocId ? "text-primary" : "text-muted-foreground")}>
                          {uploadingSelfie ? t("profile.org.uploading") : selfieDocId ? t("profile.kyc.selfieCaptured") : t("profile.kyc.selfieCta")}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          disabled={uploadingSelfie}
                          onChange={e => { const file = e.target.files?.[0]; if (file) void handleUploadSelfie(file); }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {kycStep < kycTitles.length - 1 ? (
                  <Button
                    onClick={() => setKycStep(s => s + 1)}
                    disabled={!kycReady[kycStep]}
                    className="w-full h-12 text-base font-semibold rounded-xl"
                  >
                    {t("profile.kyc.continue")}
                  </Button>
                ) : (
                  <Button
                    onClick={handleKycSubmit}
                    disabled={!kycReady[kycTitles.length - 1] || submitting}
                    className="w-full h-12 text-base font-semibold rounded-xl"
                  >
                    {t("profile.kyc.submit")}
                  </Button>
                )}
              </motion.div>
            )}

            {/* ── Step 4: Success ── */}
            {step === "complete" && (
              <motion.div key="complete" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center py-16 space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 200 }}>
                  <CheckCircle2 size={72} className="text-primary" />
                </motion.div>
                <h2 className="text-2xl font-bold text-foreground">{t("profile.activated")}</h2>
                <p className="text-muted-foreground max-w-xs">{t("profile.activatedSub")}</p>
                {existingUserId && (
                  <div className="flex flex-col gap-2.5 w-full max-w-xs pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected(null);
                        setOrgName("");
                        setKycStep(0);
                        setPhone(""); setOtp(""); setOtpResent(false);
                        setDob(""); setAddress(""); setIdType("national");
                        setIdFrontDocId(null); setIdBackDocId(null); setSelfieDocId(null);
                        setRegistrationDocId(null); setRegistrationDocName(""); setLegalRepName("");
                        setLegalRepIdType("national"); setLegalRepIdNumber(""); setLegalRepPhone("");
                        setStep("select");
                      }}
                      className="w-full h-11 rounded-xl"
                    >
                      {t("profile.addAnotherRole")}
                    </Button>
                    <Button onClick={() => navigate(base)} className="w-full h-11 rounded-xl">
                      {t("profile.goToDashboard")}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Existing account: choose which role to use ── */}
            {step === "chooseExisting" && existingRoles && (
              <motion.div key="chooseExisting" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="max-w-md mx-auto space-y-5">
                <div className="space-y-1.5 text-center">
                  <h1 className="text-xl font-bold text-foreground">{t("profile.chooseRole.title")}</h1>
                  <p className="text-sm text-muted-foreground">{t("profile.chooseRole.sub")}</p>
                </div>
                <div className="space-y-2.5">
                  {existingRoles.map(role => {
                    const config = ALL_PROFILES.find(p => p.id === role.role);
                    if (!config) return null;
                    return (
                      <button
                        key={role.id}
                        onClick={() => {
                          const profile = getDefaultProfile(role.role as ProfileType);
                          applyRealName(profile, role, currentUser?.name ?? undefined);
                          setProfile(profile);
                          navigate(base);
                        }}
                        className="w-full flex items-center gap-3.5 rounded-2xl bg-card border border-border px-4 py-3.5 text-left cursor-pointer transition-colors hover:border-primary/40"
                      >
                        <config.icon size={24} className="text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground">{t(`profile.type.${role.role}`)}</div>
                          <div className="text-xs text-muted-foreground">
                            {role.complete ? t("profile.chooseRole.verified") : t("profile.chooseRole.incomplete")}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setStep("select")}
                  className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2"
                >
                  {t("profile.chooseRole.addNew")}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
