import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Register from "./page.tsx";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate, useLocation: () => ({ state: null }) };
});

const mockUpsertSupabaseUser = vi.fn();
const mockCompleteRegistrationProfile = vi.fn();
vi.mock("@/lib/backend.ts", () => ({
  upsertSupabaseUser: (...args: unknown[]) => mockUpsertSupabaseUser(...args),
  completeRegistrationProfile: (...args: unknown[]) => mockCompleteRegistrationProfile(...args),
  sendWelcomeEmail: () => Promise.resolve(),
}));

// Street- and postal-code-autosuggest useAction() calls — both default to no
// suggestions so the existing tests (which never touch either dropdown) are
// unaffected; only the dedicated autosuggest tests override these. The
// component calls useAction(suggestStreets) then useAction(suggestPostalCodes)
// in that fixed order on every render (React's rules of hooks guarantee the
// order never changes), and Convex's api.* references have no stable
// identity to switch on, so parity of a call counter (reset every test)
// stands in for "which action is this". This is the one remaining live
// convex/react call site — the AI address-suggestion feature intentionally
// stays on Convex (see register/page.tsx's own comment).
const mockSuggestStreets = vi.fn().mockResolvedValue({ suggestions: [] });
const mockSuggestPostalCodes = vi.fn().mockResolvedValue({ suggestions: [] });
let useActionCallCount = 0;
vi.mock("convex/react", async () => {
  const actual = await vi.importActual<typeof import("convex/react")>("convex/react");
  return {
    ...actual,
    useAction: () => (useActionCallCount++ % 2 === 0 ? mockSuggestStreets : mockSuggestPostalCodes),
  };
});

vi.mock("@/contexts/profile-context.tsx", async () => {
  const actual = await vi.importActual<typeof import("@/contexts/profile-context.tsx")>("@/contexts/profile-context.tsx");
  return { ...actual, useProfile: () => ({ profile: null, setProfile: vi.fn(), clearProfile: vi.fn() }) };
});

const { mockSignUp, mockSignInWithOAuth } = vi.hoisted(() => ({ mockSignUp: vi.fn(), mockSignInWithOAuth: vi.fn() }));
vi.mock("@/lib/supabase-client.ts", () => ({
  supabase: { auth: { signUp: mockSignUp, signInWithOAuth: mockSignInWithOAuth } },
}));

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/en/register"]}>
      <Routes>
        <Route path=":lng/register" element={<Register />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillDetails() {
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Moussa" } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Diallo" } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "moussa@example.com" } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "+221 78 00 00 00" } });
  fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
  fireEvent.change(screen.getByLabelText(/^street$/i), { target: { value: "Rue de la Paix" } });
  fireEvent.change(screen.getByLabelText(/house number/i), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: "Dakar" } });
  fireEvent.change(screen.getByLabelText(/province/i), { target: { value: "Dakar" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Test1234" } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Test1234" } });
}

describe("Register", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useActionCallCount = 0;
  });

  it("requests first name, last name, email, phone, country, full address and a password", () => {
    renderRegister();

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country of registration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^street$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/house number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^city$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/province/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("keeps the province field disabled until a country is chosen", () => {
    renderRegister();
    expect(screen.getByLabelText(/province/i)).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    expect(screen.getByLabelText(/province/i)).toBeEnabled();
    expect(within(screen.getByLabelText(/province/i)).getByRole("option", { name: "Dakar" })).toBeInTheDocument();
  });

  it("loads a city dropdown once a country with known cities is chosen, falling back to free text otherwise", () => {
    renderRegister();
    // No country yet — city is a plain text field.
    expect(screen.getByLabelText(/^city$/i).tagName).toBe("INPUT");

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    expect(screen.getByLabelText(/^city$/i).tagName).toBe("SELECT");
    expect(within(screen.getByLabelText(/^city$/i)).getByRole("option", { name: "Dakar" })).toBeInTheDocument();

    // Botswana has no curated city list — falls back to free text.
    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "BW" } });
    expect(screen.getByLabelText(/^city$/i).tagName).toBe("INPUT");
  });

  it("blocks submission until every field is filled", async () => {
    renderRegister();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(mockSignUp).not.toHaveBeenCalled());
  });

  it("rejects mismatched passwords without calling the backend", async () => {
    renderRegister();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "somethingElse" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(mockSignUp).not.toHaveBeenCalled());
  });

  it("registers via Supabase, saves the profile, and shows the check-email step when confirmation is required", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "sb-uid-1" }, session: null }, error: null });
    mockUpsertSupabaseUser.mockResolvedValueOnce({ userId: "user_1", isNew: true, name: "Moussa Diallo" });
    mockCompleteRegistrationProfile.mockResolvedValueOnce(undefined);
    renderRegister();
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "moussa@example.com", password: "Test1234",
      options: { data: { firstName: "Moussa", lastName: "Diallo" } },
    });
    expect(mockUpsertSupabaseUser).toHaveBeenCalledWith({
      supabaseUserId: "sb-uid-1", email: "moussa@example.com", firstName: "Moussa", lastName: "Diallo",
    });
    expect(mockCompleteRegistrationProfile).toHaveBeenCalledWith({
      userId: "user_1", phone: "+221 78 00 00 00", country: "SN",
      street: "Rue de la Paix", houseNumber: "12", city: "Dakar", province: "Dakar", postalCode: undefined,
    });
  });

  it("routes straight into onboarding when Supabase returns an active session immediately (email confirmation off)", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "sb-uid-1" }, session: { access_token: "tok" } }, error: null });
    mockUpsertSupabaseUser.mockResolvedValueOnce({ userId: "user_1", isNew: true, name: "Moussa Diallo" });
    mockCompleteRegistrationProfile.mockResolvedValueOnce(undefined);
    renderRegister();
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/en/profile", { state: { existingUserId: "user_1", existingRoles: [] } }),
    );
    expect(localStorage.getItem("payrus_local_user_id")).toBe("user_1");
  });

  it("shows AI street suggestions once country, city and province are set, and fills the street on pick", async () => {
    mockSuggestStreets.mockResolvedValueOnce({ suggestions: ["Rue de la Paix"] });
    renderRegister();
    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: "Dakar" } });
    fireEvent.change(screen.getByLabelText(/province/i), { target: { value: "Dakar" } });
    fireEvent.change(screen.getByLabelText(/^street$/i), { target: { value: "Rue de" } });

    await waitFor(() =>
      expect(mockSuggestStreets).toHaveBeenCalledWith({ country: "SN", city: "Dakar", province: "Dakar", query: "Rue de" }),
    );
    fireEvent.click(await screen.findByText("Rue de la Paix"));

    expect(screen.getByLabelText(/^street$/i)).toHaveValue("Rue de la Paix");
  });

  it("fetches postal code suggestions as soon as country and city are set (province optional), and fills it on pick", async () => {
    mockSuggestPostalCodes.mockResolvedValueOnce({
      suggestions: [{ postalCode: "BP 1234", area: "Plateau" }, { postalCode: "BP 5678" }],
    });
    renderRegister();
    expect(mockSuggestPostalCodes).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: "Dakar" } });

    await waitFor(() =>
      expect(mockSuggestPostalCodes).toHaveBeenCalledWith({ country: "SN", city: "Dakar", province: undefined }),
    );
    fireEvent.click(await screen.findByText("BP 1234"));

    expect(screen.getByLabelText(/postal code/i)).toHaveValue("BP 1234");
    expect(screen.getByLabelText(/area \/ district/i)).toHaveValue("Plateau");
  });

  it("offers area-only suggestions for cities without postal codes and fills the area field", async () => {
    mockSuggestPostalCodes.mockResolvedValueOnce({
      suggestions: [{ postalCode: "", area: "Ngaliema" }, { postalCode: "", area: "Kintambo" }],
    });
    renderRegister();

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "CD" } });
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: "Kinshasa" } });

    fireEvent.click(await screen.findByText("Ngaliema"));

    expect(screen.getByLabelText(/area \/ district/i)).toHaveValue("Ngaliema");
    expect(screen.getByLabelText(/postal code/i)).toHaveValue("");
  });

  it("does not request street suggestions before a country and city are chosen", async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/^street$/i), { target: { value: "Rue de" } });

    await new Promise((r) => setTimeout(r, 450));
    expect(mockSuggestStreets).not.toHaveBeenCalled();
  });

  it("reveals the provider icons behind the grey social sign-up button, then redirects on click", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    renderRegister();

    // Provider icons are collapsed behind the single grey button until clicked.
    expect(screen.queryByText("Google")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Continue with a social account"));
    fireEvent.click(screen.getByText("Google"));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: expect.stringContaining("/en/auth/callback") },
    }));
    expect(mockUpsertSupabaseUser).not.toHaveBeenCalled();
  });

  it("adapts the phone field's country code when a country is chosen, without overwriting a number already typed", () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("+221 ");

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "+221 770000000" } });
    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "FR" } });
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("+221 770000000");
  });

  it("keeps re-adjusting the phone country code across multiple country changes until a real number is typed", () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("+221 ");

    // Switching again without typing anything should re-adjust the prefix,
    // not just apply it once on the first-ever selection.
    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "FR" } });
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("+33 ");

    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "DE" } });
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("+49 ");

    // Once the user types a real number, further country changes stop
    // touching the phone field.
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "+49 15112345678" } });
    fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: "SN" } });
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("+49 15112345678");
  });
});
