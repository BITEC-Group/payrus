// React Query wrappers around src/lib/backend.ts, designed so each call
// site's migration off `convex/react` is a small, mechanical diff:
//   - useQuery(api.x.y, args | "skip")   ->  useXxx(args | undefined)  (same
//     "undefined while loading/disabled" return shape)
//   - useMutation(api.x.y)               ->  useXxxMutation()  (also returns
//     a directly-callable async function, not react-query's {mutate,...}
//     object, so `const fn = useXxxMutation(); await fn(args)` still reads
//     the same as the Convex version did)
import { useQuery as useReactQuery, useMutation as useReactMutation, useQueryClient } from "@tanstack/react-query";
import * as backend from "@/lib/backend.ts";
import * as orgBackend from "@/lib/org-backend.ts";

// ---------------------------------------------------------------------------
// Identity / roles / addresses
// ---------------------------------------------------------------------------

export function useAppUserById(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["appUser", userId],
    queryFn: () => backend.getUserById(userId!),
    enabled: !!userId,
  }).data;
}

export function useRoleDefinitions() {
  return useReactQuery({
    queryKey: ["roleDefinitions"],
    queryFn: backend.listRoleDefinitions,
    staleTime: 5 * 60 * 1000,
  }).data;
}

export function useMyCounterparts(userId: string | undefined, query: string) {
  return useReactQuery({
    queryKey: ["counterparts", userId, query],
    queryFn: () => backend.searchMyCounterparts(query),
    enabled: !!userId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useOpenCorridors() {
  return useReactQuery({
    queryKey: ["openCorridors"],
    queryFn: backend.listOpenCorridors,
    staleTime: 60_000,
    retry: false,
  }).data;
}

export function useRemittanceQuote(from: string, to: string, amount: number, enabled: boolean) {
  return useReactQuery({
    queryKey: ["remittanceQuote", from, to, amount],
    queryFn: () => backend.getRemittanceQuote(from, to, amount),
    enabled: enabled && amount > 0 && from !== to,
    staleTime: 15_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function useSendRemittanceMutation() {
  const invalidate = useInvalidateWalletQueries();
  return useReactMutation({
    mutationFn: backend.sendRemittance,
    onSuccess: (_d, v) => invalidate(v.userId),
  }).mutateAsync;
}

export function useSavedRecipients(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["savedRecipients", userId],
    queryFn: backend.listSavedRecipients,
    enabled: !!userId,
    staleTime: 30_000,
  });
}

function useRecipientMutation<A, R>(fn: (a: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useReactMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savedRecipients"] }),
  }).mutateAsync;
}
export const useSaveRecipientMutation = () => useRecipientMutation(backend.saveRecipient);
export const useTouchSavedRecipientMutation = () => useRecipientMutation(backend.touchSavedRecipient);
export const useDeleteSavedRecipientMutation = () => useRecipientMutation(backend.deleteSavedRecipient);

export function useMyReceivers(enabled: boolean) {
  return useReactQuery({ queryKey: ["receivers"], queryFn: backend.listMyReceivers, enabled, staleTime: 30_000, retry: false });
}

// Polled so a payout that settles (mobile money / bank) flips to "paid out" on screen.
export function useMyPayouts(enabled: boolean) {
  return useReactQuery({ queryKey: ["payouts"], queryFn: backend.listMyPayouts, enabled, refetchInterval: 20_000, retry: false });
}

export function useSendToReceiverMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: async (a: backend.ReceiverInput & { senderId: string; amount: number; from: string; note?: string; agentId?: string }) => {
      const receiverId = await backend.saveReceiver(a);
      return backend.sendToReceiver({ senderId: a.senderId, receiverId, amount: a.amount, from: a.from, note: a.note, agentId: a.agentId });
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: ["walletViews", v.senderId] });
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["receivers"] });
      void queryClient.invalidateQueries({ queryKey: ["payouts"] });
    },
  });
  return mutation.mutateAsync;
}

export function useP2pTransferMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.p2pTransfer,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.senderId] });
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["counterparts"] });
    },
  });
  return mutation.mutateAsync;
}

export function useAddressesForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["addresses", userId],
    queryFn: () => backend.listAddressesForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useUserRolesForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["userRoles", userId],
    queryFn: () => backend.listUserRolesForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useUpsertUserRoleMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.upsertUserRole,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["userRoles", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["cards", variables.userId] });
    },
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Wallets / transfers
// ---------------------------------------------------------------------------

export function useWalletViewsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["walletViews", userId],
    queryFn: () => backend.listWalletViewsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useRecentTransfersForUser(userId: string | undefined, limit = 10) {
  return useReactQuery({
    queryKey: ["recentTransfers", userId, limit],
    queryFn: () => backend.listRecentTransfersForUser(userId!, limit),
    enabled: !!userId,
  }).data;
}

export function useTransfersForWallet(walletViewId: string | undefined) {
  return useReactQuery({
    queryKey: ["transfersForWallet", walletViewId],
    queryFn: () => backend.listTransfersForWallet(walletViewId!),
    enabled: !!walletViewId,
  }).data;
}

function useInvalidateWalletQueries() {
  const queryClient = useQueryClient();
  return (userId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["walletViews", userId] });
    void queryClient.invalidateQueries({ queryKey: ["recentTransfers", userId] });
  };
}

export function useDepositMutation() {
  const invalidate = useInvalidateWalletQueries();
  const mutation = useReactMutation({
    mutationFn: backend.depositToWallet,
    onSuccess: (_data, variables) => invalidate(variables.userId),
  });
  return mutation.mutateAsync;
}

export function useApplyWalletTransferMutation() {
  const invalidate = useInvalidateWalletQueries();
  const mutation = useReactMutation({
    mutationFn: backend.applyWalletTransfer,
    onSuccess: (_data, variables) => invalidate(variables.userId),
  });
  return mutation.mutateAsync;
}

export function useConvertBetweenWalletsMutation() {
  const invalidate = useInvalidateWalletQueries();
  const mutation = useReactMutation({
    mutationFn: backend.convertBetweenWallets,
    onSuccess: (_data, variables) => invalidate(variables.userId),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function useCardsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["cards", userId],
    queryFn: () => backend.listCardsForUser(userId!),
    enabled: !!userId,
  }).data;
}

// Migration 0065/0066: open a wallet, issue and manage cards, preview which wallet pays a remittance.
export function useWalletCurrencies() {
  return useReactQuery({ queryKey: ["walletCurrencies"], queryFn: backend.listWalletCurrencies, staleTime: 5 * 60_000 }).data;
}

export function useCreateMyWalletMutation() {
  const invalidate = useInvalidateWalletQueries();
  return useReactMutation({
    mutationFn: backend.createMyWallet,
    onSuccess: (_d, v) => invalidate(v.userId),
  }).mutateAsync;
}

export function useIssueCardMutation() {
  const queryClient = useQueryClient();
  return useReactMutation({
    mutationFn: backend.issueCard,
    onSuccess: (_d, v) => void queryClient.invalidateQueries({ queryKey: ["cards", v.userId] }),
  }).mutateAsync;
}

export function useSetCardLockedMutation() {
  const queryClient = useQueryClient();
  return useReactMutation({
    mutationFn: backend.setCardLocked,
    onSuccess: (_d, v) => void queryClient.invalidateQueries({ queryKey: ["cards", v.userId] }),
  }).mutateAsync;
}

export function useUpdateCardSettingsMutation() {
  const queryClient = useQueryClient();
  return useReactMutation({
    mutationFn: backend.updateCardSettings,
    onSuccess: (_d, v) => void queryClient.invalidateQueries({ queryKey: ["cards", v.userId] }),
  }).mutateAsync;
}

export function useRemittancePayFrom(userId: string | undefined, from: string, to: string, amount: number) {
  return useReactQuery({
    queryKey: ["remittancePayFrom", userId, from, to, amount],
    queryFn: () => backend.getRemittancePayFrom({ userId: userId!, from, to, amount }),
    enabled: !!userId && amount > 0 && from !== to,
    staleTime: 10_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Linked payment methods
// ---------------------------------------------------------------------------

export function useLinkedPaymentMethods(ownerKey: string | undefined) {
  return useReactQuery({
    queryKey: ["linkedPaymentMethods", ownerKey],
    queryFn: () => backend.listLinkedPaymentMethods(ownerKey!),
    enabled: !!ownerKey,
  }).data;
}

export function useAddLinkedPaymentMethodMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.addLinkedPaymentMethod,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["linkedPaymentMethods", variables.ownerKey] }),
  });
  return mutation.mutateAsync;
}

export function useSeedDefaultLinkedPaymentMethodsMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.seedDefaultLinkedPaymentMethods,
    onSuccess: (_data, ownerKey) => void queryClient.invalidateQueries({ queryKey: ["linkedPaymentMethods", ownerKey] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Marketplace / shop
// ---------------------------------------------------------------------------

export function useMarketplacePartners() {
  return useReactQuery({ queryKey: ["marketplacePartners"], queryFn: backend.listMarketplacePartners }).data;
}

export function useCreateShopOrderMutation() {
  const mutation = useReactMutation({ mutationFn: backend.createShopOrder });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function useAdminListUsers() {
  return useReactQuery({ queryKey: ["adminUsers"], queryFn: backend.adminListUsers }).data;
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
}

export function useAdminUpdateUserRoleMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.adminUpdateUserRole, onSuccess: invalidate });
  return mutation.mutateAsync;
}

export function useAiSuggestions() {
  return useReactQuery({ queryKey: ["aiSuggestions"], queryFn: backend.listAiSuggestions, retry: false });
}

export function useRunTriageMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.runTriage,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["aiSuggestions"] }),
  });
  return mutation.mutateAsync;
}

export function useMarkAiSuggestionMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: (args: { id: string; status: "used" | "dismissed" }) => backend.markAiSuggestion(args.id, args.status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["aiSuggestions"] }),
  });
  return mutation.mutateAsync;
}

export function useAdminEscalations() {
  return useReactQuery({ queryKey: ["adminEscalations"], queryFn: backend.adminListEscalations });
}

export function useSupportRequestEscalationMutation() { return useStaffMutation(backend.supportRequestEscalation); }
export function useAdminResolveEscalationMutation() { return useStaffMutation(backend.adminResolveEscalation); }

export function useAdminUpdateUserMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.adminUpdateUser, onSuccess: invalidate });
  return mutation.mutateAsync;
}

export function useAdminListTransfers(limit = 300, userId?: string) {
  return useReactQuery({ queryKey: ["adminTransfers", limit, userId ?? null], queryFn: () => backend.adminListTransfers(limit, userId) });
}

export function useMyPermissions() {
  return useReactQuery({ queryKey: ["myPermissions"], queryFn: backend.getMyPermissions, staleTime: 60_000 }).data;
}

export function useMyPermissionsQuery() {
  return useReactQuery({ queryKey: ["myPermissions"], queryFn: backend.getMyPermissions, staleTime: 60_000, retry: false });
}

export function useMyOrgMemberships() {
  return useReactQuery({ queryKey: ["org", "memberships"], queryFn: orgBackend.myMemberships, staleTime: 60_000, retry: false });
}

export function useAdminOpsRows<T>(rpcName: string) {
  return useReactQuery({ queryKey: ["adminOps", rpcName], queryFn: () => backend.adminRpcRows<T>(rpcName), retry: false });
}

export function useAdminAuditEvents(objectTable?: string) {
  return useReactQuery({ queryKey: ["adminAudit", objectTable ?? "all"], queryFn: () => backend.adminListAuditEvents(objectTable), retry: false });
}

export function useSupportRoles() {
  return useReactQuery({ queryKey: ["supportRoles"], queryFn: backend.listSupportRoles }).data;
}

export function useSupportPermissions() {
  return useReactQuery({ queryKey: ["supportPermissions"], queryFn: backend.listSupportPermissions }).data;
}

function useStaffMutation<TArgs>(fn: (args: TArgs) => Promise<void>) {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["supportPermissions", "adminUsers", "adminTransfers", "adminEscalations", "myPermissions"]) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
  return mutation.mutateAsync;
}

export function useAdminSetSupportPermissionMutation() { return useStaffMutation(backend.adminSetSupportPermission); }
export function useAdminResolveExpenseReportMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.adminResolveExpenseReport,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminOps"] });
      void queryClient.invalidateQueries({ queryKey: ["adminAudit"] });
    },
  });
  return mutation.mutateAsync;
}
export function useAdminSetGatePasswordMutation() {
  const mutation = useReactMutation({ mutationFn: backend.adminSetGatePassword });
  return mutation.mutateAsync;
}
export function useAdminAssignStaffRoleMutation() { return useStaffMutation(backend.adminAssignStaffRole); }
export function useAdminRevokeStaffRoleMutation() { return useStaffMutation(backend.adminRevokeStaffRole); }
export function useSupportCompleteTransferMutation() { return useStaffMutation(backend.supportCompleteTransfer); }
export function useSupportResolveTransferMutation() { return useStaffMutation(backend.supportResolveTransfer); }
export function useSupportVoidTransferMutation() { return useStaffMutation(backend.supportVoidTransfer); }
export function useSupportCreateAdjustmentMutation() { return useStaffMutation(backend.supportCreateAdjustment); }

export function useAdminCreateUserMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.adminCreateUser, onSuccess: invalidate });
  return mutation.mutateAsync;
}

export function useAdminGrantAdminRoleMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.adminGrantAdminRole, onSuccess: invalidate });
  return mutation.mutateAsync;
}

export function useCurrenciesByCode(codes: string[]) {
  return useReactQuery({
    queryKey: ["currencies", ...codes],
    queryFn: () => backend.listCurrenciesByCode(codes),
  }).data;
}

export function useCurrentFxMarginConfig() {
  return useReactQuery({
    queryKey: ["fxMarginConfig"],
    queryFn: backend.getCurrentFxMarginConfig,
  }).data;
}

export function useUpdateFxMarginConfigMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.updateFxMarginConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fxMarginConfig"] }),
  });
  return mutation.mutateAsync;
}

export function useAdminBlockedTransfers() {
  return useReactQuery({ queryKey: ["adminBlockedTransfers"], queryFn: backend.adminListBlockedTransfers }).data;
}

export function useAdminResolveTransferMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.adminResolveTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminBlockedTransfers"] }),
  });
  return mutation.mutateAsync;
}

export function useAdminPendingProfiles() {
  return useReactQuery({ queryKey: ["adminPendingProfiles"], queryFn: backend.adminListPendingProfiles }).data;
}

export function useTestUsersCleanupMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.testUsersCleanup, onSuccess: invalidate });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Roles & Access
// ---------------------------------------------------------------------------

export function useAdminReassignUserRoleMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.adminReassignUserRole, onSuccess: invalidate });
  return mutation.mutateAsync;
}

export function useAdminRemoveUserRoleMutation() {
  const invalidate = useInvalidateAdmin();
  const mutation = useReactMutation({ mutationFn: backend.adminRemoveUserRole, onSuccess: invalidate });
  return mutation.mutateAsync;
}

export function useProfileFeatures(profileType: string | undefined) {
  return useReactQuery({
    queryKey: ["profileFeatures", profileType],
    queryFn: () => backend.getProfileFeatures(profileType!),
    enabled: !!profileType,
  }).data;
}

export function useAdminSetProfileFeaturesMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.adminSetProfileFeatures,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["profileFeatures", variables.profileType] }),
  });
  return mutation.mutateAsync;
}

export function useAdminSetConsoleRoleTabsMutation() {
  const mutation = useReactMutation({ mutationFn: backend.adminSetConsoleRoleTabs });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Notifications / payment links
// ---------------------------------------------------------------------------

export function useNotificationsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["notifications", userId],
    queryFn: () => backend.listNotificationsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useMarkNotificationReadMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
  return mutation.mutateAsync;
}

export function usePaymentLinksForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["paymentLinks", userId],
    queryFn: () => backend.listPaymentLinksForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useCreatePaymentLinkMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createPaymentLink,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["paymentLinks", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export function useBillBillers() {
  return useReactQuery({ queryKey: ["billBillers"], queryFn: backend.listBillBillers }).data;
}

export function useBillSubscriptionsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["billSubscriptions", userId],
    queryFn: () => backend.listBillSubscriptionsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useUpsertBillSubscriptionMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.upsertBillSubscription,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["billSubscriptions", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export function usePayoutBatchesForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["payoutBatches", userId],
    queryFn: () => backend.listPayoutBatchesForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function usePayoutItems(batchId: string | undefined) {
  return useReactQuery({
    queryKey: ["payoutItems", batchId],
    queryFn: () => backend.listPayoutItems(batchId!),
    enabled: !!batchId,
  }).data;
}

export function useCreatePayoutBatchMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createPayoutBatch,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["payoutBatches", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
    },
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function useGroupsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["groups", userId],
    queryFn: () => backend.listGroupsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createGroup,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["groups", variables.ownerUserId] }),
  });
  return mutation.mutateAsync;
}

export function useGroupMembers(groupId: string | undefined, ownerUserId: string | undefined) {
  return useReactQuery({
    queryKey: ["groupMembers", groupId],
    queryFn: () => backend.listGroupMembers({ groupId: groupId!, ownerUserId: ownerUserId! }),
    enabled: !!groupId && !!ownerUserId,
  }).data;
}

export function useAddGroupMemberMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.addGroupMember,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["groupMembers", variables.groupId] }),
  });
  return mutation.mutateAsync;
}

export function useRemoveGroupMemberMutation(groupId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.removeGroupMember,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["groupMembers", groupId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export function useDisputesForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["disputes", userId],
    queryFn: () => backend.listDisputesForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useCreateDisputeMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createDispute,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["disputes", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export function useApiKeysForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["apiKeys", userId],
    queryFn: () => backend.listApiKeysForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createApiKey,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["apiKeys", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.revokeApiKey,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["apiKeys", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Fundraise
// ---------------------------------------------------------------------------

export function useCampaigns() {
  return useReactQuery({ queryKey: ["campaigns"], queryFn: backend.listCampaigns }).data;
}

export function useCreateCampaignMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createCampaign,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  return mutation.mutateAsync;
}

export function useDonateToCampaignMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.donateToCampaign,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

export function useFlights() {
  return useReactQuery({ queryKey: ["flights"], queryFn: backend.listFlights }).data;
}

export function useHotels() {
  return useReactQuery({ queryKey: ["hotels"], queryFn: backend.listHotels }).data;
}

export function useBookTravelItemMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.bookTravelItem,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// Migration 0062: dated bookings, cancel/refund, favourites, reviews.
export function useBookTravelMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.bookTravel,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelBookings", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelInstallmentPlans", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["flights"] });
    },
  });
  return mutation.mutateAsync;
}

export function useBookPartnerQuoteMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.bookPartnerQuote,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelBookings", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelInstallmentPlans", variables.userId] });
    },
  });
  return mutation.mutateAsync;
}

export function useCancelTravelBookingMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.cancelTravelBooking,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelBookings", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelInstallmentPlans", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["flights"] });
    },
  });
  return mutation.mutateAsync;
}

export function useTravelBookings(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["travelBookings", userId],
    queryFn: () => backend.listTravelBookings(userId!),
    enabled: !!userId,
  }).data;
}

export function useTravelFavorites(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["travelFavorites", userId],
    queryFn: () => backend.listTravelFavorites(userId!),
    enabled: !!userId,
  }).data;
}

export function useToggleTravelFavoriteMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.toggleTravelFavorite,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["travelFavorites", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useTravelReviews(userId: string | undefined) {
  return useReactQuery({ queryKey: ["travelReviews", userId ?? null], queryFn: () => backend.listTravelReviews(userId) }).data;
}

export function useAddTravelReviewMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.addTravelReview,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["travelReviews"] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export function useSavingsPotsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["savingsPots", userId],
    queryFn: () => backend.listSavingsPotsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useCreateSavingsPotMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createSavingsPot,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["savingsPots", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useContributeToPotMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.contributeToPot,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["savingsPots", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useTontineCircles() {
  return useReactQuery({ queryKey: ["tontineCircles"], queryFn: backend.listTontineCircles }).data;
}

export function useJoinTontineMutation() {
  const mutation = useReactMutation({ mutationFn: backend.joinTontine });
  return mutation.mutateAsync;
}

export function useContributeToTontineMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.contributeToTontine,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tontineCircles"] }),
  });
  return mutation.mutateAsync;
}

export function useCreateTontineCircleMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createTontineCircle,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tontineCircles"] }),
  });
  return mutation.mutateAsync;
}

export function useInvestmentProducts() {
  return useReactQuery({ queryKey: ["investmentProducts"], queryFn: backend.listInvestmentProducts }).data;
}

export function useInvestInProductMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.investInProduct,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Invest
// ---------------------------------------------------------------------------

export function usePitches() {
  return useReactQuery({ queryKey: ["pitches"], queryFn: backend.listPitches }).data;
}

export function usePitchInvestmentsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["pitchInvestments", userId],
    queryFn: () => backend.listPitchInvestmentsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function usePitchRepayments(investmentId: string | undefined) {
  return useReactQuery({
    queryKey: ["pitchRepayments", investmentId],
    queryFn: () => backend.listPitchRepayments(investmentId!),
    enabled: !!investmentId,
  }).data;
}

export function useInvestInPitchMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.investInPitch,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["pitchInvestments", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useCreatePitchMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createPitch,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pitches"] }),
  });
  return mutation.mutateAsync;
}

export function useInvestorLeaderboard(limit = 20) {
  return useReactQuery({ queryKey: ["investorLeaderboard", limit], queryFn: () => backend.getInvestorLeaderboard(limit) }).data;
}

export function usePlatformImpact() {
  return useReactQuery({ queryKey: ["platformImpact"], queryFn: backend.getPlatformImpact }).data;
}

export function useSectorPopularity() {
  return useReactQuery({ queryKey: ["sectorPopularity"], queryFn: backend.getSectorPopularity }).data;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export function usePlaceBetMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.placeBet,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useResolveBetMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.resolveBet,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Loyalty accounts
// ---------------------------------------------------------------------------

export function useLoyaltyAccountsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["loyaltyAccounts", userId],
    queryFn: () => backend.listLoyaltyAccountsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useLoyaltySpendHistory(accountId: string | undefined) {
  return useReactQuery({
    queryKey: ["loyaltySpendHistory", accountId],
    queryFn: () => backend.listLoyaltySpendHistory(accountId!),
    enabled: !!accountId,
  }).data;
}

export function useLinkLoyaltyVenueMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.linkLoyaltyVenue,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["loyaltyAccounts", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useSetLoyaltySpendLimitMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.setLoyaltySpendLimit,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["loyaltyAccounts", variables.userId] }),
  });
  return mutation.mutateAsync;
}

export function useRecordVenueSpendMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.recordVenueSpend,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["loyaltyAccounts", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
    },
  });
  return mutation.mutateAsync;
}

export function useRedeemLoyaltyRewardMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.redeemLoyaltyReward,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["loyaltyAccounts", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Expense reports
// ---------------------------------------------------------------------------

export function useExpenseReportsForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["expenseReports", userId],
    queryFn: () => backend.listExpenseReportsForUser(userId!),
    enabled: !!userId,
  }).data;
}

export function useSubmitExpenseReportMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.submitExpenseReport,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["expenseReports", variables.userId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Corporate cards
// ---------------------------------------------------------------------------

export function useCorporateCardsForUser(ownerUserId: string | undefined) {
  return useReactQuery({
    queryKey: ["corporateCards", ownerUserId],
    queryFn: () => backend.listCorporateCardsForUser(ownerUserId!),
    enabled: !!ownerUserId,
  }).data;
}

export function useCreateCorporateCardMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.createCorporateCard,
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ["corporateCards", variables.ownerUserId] }),
  });
  return mutation.mutateAsync;
}

// ---------------------------------------------------------------------------
// Travel installments
// ---------------------------------------------------------------------------

export function useBookTravelItemInstallmentsMutation() {
  const queryClient = useQueryClient();
  const mutation = useReactMutation({
    mutationFn: backend.bookTravelItemInstallments,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["walletViews", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["travelInstallmentPlans", variables.userId] });
    },
  });
  return mutation.mutateAsync;
}

export function useTravelInstallments(planId: string | undefined) {
  return useReactQuery({
    queryKey: ["travelInstallments", planId],
    queryFn: () => backend.listTravelInstallments(planId!),
    enabled: !!planId,
  }).data;
}

export function useTravelInstallmentPlansForUser(userId: string | undefined) {
  return useReactQuery({
    queryKey: ["travelInstallmentPlans", userId],
    queryFn: () => backend.listTravelInstallmentPlansForUser(userId!),
    enabled: !!userId,
  }).data;
}

// One transaction in full (migration 0050); polled while a payout is still moving so its status flips on screen.
export function useTransactionDetail(reference: string | undefined) {
  return useReactQuery({
    queryKey: ["transactionDetail", reference],
    queryFn: () => backend.getTransactionDetail(reference!),
    enabled: !!reference,
    refetchInterval: (q) => (q.state.data?.payout && ["processing", "ready_for_pickup"].includes(q.state.data.payout.status) ? 20_000 : false),
    retry: false,
  });
}
