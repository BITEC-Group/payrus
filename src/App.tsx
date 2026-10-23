import { Suspense } from "react";
import { StaffMfaGate } from "@/components/mfa/mfa-ui.tsx";
import { AdminCockpitGate } from "@/pages/admin/cockpit-gate.tsx";
import ConsentGate from "@/components/ui/consent-gate.tsx";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import { DefaultProviders } from "./components/providers/default.tsx";
import LocaleWrapper from "./components/providers/locale-wrapper.tsx";
import { SAVED_OR_DEFAULT_LOCALE, setLocaleInPath } from "./i18n.ts";
import "./i18n.ts";
import AppLayout from "./pages/layout/AppLayout.tsx";
import Welcome from "./pages/welcome/page.tsx";
import StatusPage from "./pages/status/page.tsx";
import SignIn from "./pages/signin/page.tsx";
import Register from "./pages/register/page.tsx";
import Recover from "./pages/recover/page.tsx";
import AuthCallback from "./pages/auth-callback/page.tsx";
import ResetPassword from "./pages/reset-password/page.tsx";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/dashboard/page.tsx";
import Payments from "./pages/payments/page.tsx";
import Remittance from "./pages/remittance/page.tsx";
import Transactions from "./pages/transactions/page.tsx";
import TransactionDetailPage from "./pages/transactions/detail.tsx";
import Cards from "./pages/cards/page.tsx";
import ProfileSelection from "./pages/profile/page.tsx";
import P2PTransfer from "./pages/p2p/page.tsx";
import GroupTransfers from "./pages/groups/page.tsx";
import GovHub from "./pages/gov/page.tsx";
import ApiHub from "./pages/api-hub/page.tsx";
import AdminDashboard from "./pages/admin/page.tsx";
import OrganisationPage from "./pages/organisation/page.tsx";
import RegisterCustomer from "./pages/register-customer/page.tsx";
import SavingsPage from "./pages/savings/page.tsx";
import InvestPage from "./pages/invest/page.tsx";
import FundraisePage from "./pages/fundraise/page.tsx";
import TravelPage from "./pages/travel/page.tsx";
import GamesPage from "./pages/games/page.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import NotificationsPage from "./pages/notifications/page.tsx";
import WalletPage from "./pages/wallet/page.tsx";
import ScanToPay from "./pages/scan/page.tsx";
import PointOfSale from "./pages/pos/page.tsx";
import PaymentLinks from "./pages/payment-links/page.tsx";
import Treasury from "./pages/treasury/page.tsx";
import Bills from "./pages/bills/page.tsx";
import Payouts from "./pages/payouts/page.tsx";
import Disputes from "./pages/disputes/page.tsx";
import Shop from "./pages/shop/page.tsx";
import ModulePage, { ModulesIndex } from "./pages/modules/page.tsx";
import PlansPage from "./pages/plans/page.tsx";
import NotFound from "./pages/NotFound.tsx";

function RootRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={setLocaleInPath(SAVED_OR_DEFAULT_LOCALE, "/", location.search, location.hash)}
      replace
    />
  );
}

export default function App() {
  useServiceWorker();

  return (
    <DefaultProviders>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ConsentGate />
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            <Route
              path="/:lng"
              element={
                <LocaleWrapper>
                  <Outlet />
                </LocaleWrapper>
              }
            >
              <Route path="welcome" element={<Welcome />} />
              <Route path="status" element={<StatusPage />} />
              <Route path="signin" element={<SignIn />} />
              <Route path="register" element={<Register />} />
              <Route path="recover" element={<Recover />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="auth/callback" element={<AuthCallback />} />
              <Route element={<AppLayout />}>
              <Route index element={<Index />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="payments" element={<Payments />} />
              <Route path="remittance" element={<Remittance />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="transactions/:reference" element={<TransactionDetailPage />} />
              <Route path="cards" element={<Cards />} />
              <Route path="p2p" element={<P2PTransfer />} />
              <Route path="groups" element={<GroupTransfers />} />
              <Route path="profile" element={<ProfileSelection />} />
              <Route path="gov" element={<GovHub />} />
              <Route path="api-hub" element={<ApiHub />} />
              <Route path="admin" element={<AdminCockpitGate><StaffMfaGate><AdminDashboard /></StaffMfaGate></AdminCockpitGate>} />
              <Route path="organisation" element={<OrganisationPage />} />
              <Route path="register-customer" element={<RegisterCustomer />} />
              <Route path="savings" element={<SavingsPage />} />
              <Route path="invest" element={<InvestPage />} />
              <Route path="travel" element={<TravelPage />} />
              <Route path="games" element={<GamesPage />} />
              <Route path="fundraise" element={<FundraisePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="scan" element={<ScanToPay />} />
              <Route path="pos" element={<PointOfSale />} />
              <Route path="payment-links" element={<PaymentLinks />} />
              <Route path="treasury" element={<Treasury />} />
              <Route path="bills" element={<Bills />} />
              <Route path="payouts" element={<Payouts />} />
              <Route path="disputes" element={<Disputes />} />
              <Route path="shop" element={<Shop />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="modules" element={<ModulesIndex />} />
              <Route path="modules/:module" element={<ModulePage />} />
              <Route path="*" element={<NotFound />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DefaultProviders>
  );
}
