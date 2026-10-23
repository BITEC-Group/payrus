import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client.ts";

// PRS-IAM-008: the auth provider's user id is read only here (the identity layer). Everything else works with the
// canonical customer id (public.users.id) so the provider can be swapped without touching feature code.
export const subjectOf = (session: Pick<Session, "user"> | { user: { id: string } } | null | undefined): string | null => session?.user?.id ?? null;

export async function currentSubject(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return subjectOf(data.session);
}
