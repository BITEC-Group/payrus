import type { TFunction } from "i18next";
import type { InstModule, KindField, PendingApproval, RecordKind, SubProfile } from "./institutional.ts";

/**
 * The sub-profile, module and record-kind catalog is seeded in English by the database (migrations 0053/0054).
 * Display text is looked up under "cat.<English text>" so it follows the language switch; anything without a
 * translation is shown as written. Only display text is translated: slugs, statuses and select options stay
 * as stored, because the code and the database compare against them.
 */
export const catText = (t: TFunction, s: string): string => (s ? t(`cat.${s}`, { defaultValue: s }) : s);

const capitalise = (s: string) => s.replace(/^./, (c) => c.toLocaleUpperCase());

/** A record status ("pending_approval", "written_off") as a sentence-case label in the active language. */
export const statusText = (t: TFunction, status: string): string => capitalise(t(`cat.${status}`, { defaultValue: status.replace(/_/g, " ") }));

const localizeField = (t: TFunction, f: KindField): KindField => ({ ...f, label: catText(t, f.label) });

export const localizeSubProfile = (t: TFunction, s: SubProfile): SubProfile => ({
  ...s, label: catText(t, s.label), description: catText(t, s.description), badge: catText(t, s.badge), features: s.features.map((f) => catText(t, f)),
});

export const localizeModule = <M extends InstModule>(t: TFunction, m: M): M => ({ ...m, label: catText(t, m.label), description: catText(t, m.description) });

export const localizeKind = (t: TFunction, k: RecordKind): RecordKind => ({
  ...k, label: catText(t, k.label), pluralLabel: catText(t, k.pluralLabel), fields: k.fields.map((f) => localizeField(t, f)),
});

export const localizeApproval = (t: TFunction, a: PendingApproval): PendingApproval => ({ ...a, kindLabel: catText(t, a.kindLabel) });
