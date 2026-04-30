import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";

vi.mock("axios");

// Dashboard holds _token in module scope — reset the module before each test
// so every test starts unauthenticated
let Dashboard;
beforeEach(async () => {
  vi.resetModules();
  vi.mocked(axios.get).mockResolvedValue({ data: [] });
  vi.mocked(axios.post).mockResolvedValue({
    data: { token: "fake-jwt", user: { id: "1", email: "ops@pcsww.com", name: "Ops" } },
  });
  const mod = await import("../../components/dashboard/Dashboard.jsx");
  Dashboard = mod.default;
});

function renderDashboard() {
  render(<Dashboard />);
}

async function login(user) {
  await user.type(screen.getByPlaceholderText(/email address/i), "ops@pcsww.com");
  await user.type(screen.getByPlaceholderText(/^password$/i), "secret");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument());
}

describe("Dashboard", () => {
  describe("login screen", () => {
    test("shows login form when unauthenticated", () => {
      renderDashboard();
      expect(screen.getByRole("heading", { name: /dashboard access/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    });

    test("shows error when login fails", async () => {
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: { data: { error: "Invalid email or password." } },
      });
      renderDashboard();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/email address/i), "bad@example.com");
      await user.type(screen.getByPlaceholderText(/^password$/i), "wrong");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
      await waitFor(() => {
        expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
      });
    });

    test("shows dashboard after successful login", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      expect(screen.getByRole("heading", { name: /reseller pipeline/i })).toBeInTheDocument();
    });
  });

  describe("change password modal (AETI-004)", () => {
    test("opens change password modal when button clicked", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
    });

    test("renders current password field in the modal", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      expect(screen.getByPlaceholderText("Current password")).toBeInTheDocument();
    });

    test("save button is disabled when current password is empty", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      expect(screen.getByRole("button", { name: /save password/i })).toBeDisabled();
    });

    test("save button remains disabled when only new passwords are filled but current is empty", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      await user.type(screen.getByPlaceholderText("New password"), "NewPass1!");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "NewPass1!");
      expect(screen.getByRole("button", { name: /save password/i })).toBeDisabled();
    });

    test("save button enabled when all three password fields are valid", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      await user.type(screen.getByPlaceholderText("Current password"), "OldPass1!");
      await user.type(screen.getByPlaceholderText("New password"), "NewPass1!");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "NewPass1!");
      expect(screen.getByRole("button", { name: /save password/i })).not.toBeDisabled();
    });

    test("shows password mismatch warning when confirm doesn't match", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      await user.type(screen.getByPlaceholderText("New password"), "NewPass1!");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "Different1!");
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    test("shows API error when current password is wrong", async () => {
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { token: "fake-jwt", user: { id: "1", email: "ops@pcsww.com", name: "Ops" } },
      });
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: { data: { error: "Current password is incorrect." } },
      });
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      await user.type(screen.getByPlaceholderText("Current password"), "WrongPass1!");
      await user.type(screen.getByPlaceholderText("New password"), "NewPass1!");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "NewPass1!");
      await user.click(screen.getByRole("button", { name: /save password/i }));
      await waitFor(() => {
        expect(screen.getByText("Current password is incorrect.")).toBeInTheDocument();
      });
    });

    test("shows success message after password change", async () => {
      vi.mocked(axios.post)
        .mockResolvedValueOnce({ data: { token: "fake-jwt", user: { id: "1", email: "ops@pcsww.com", name: "Ops" } } })
        .mockResolvedValueOnce({ data: { changed: true } });
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      await user.type(screen.getByPlaceholderText("Current password"), "OldPass1!");
      await user.type(screen.getByPlaceholderText("New password"), "NewPass1!");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "NewPass1!");
      await user.click(screen.getByRole("button", { name: /save password/i }));
      await waitFor(() => {
        expect(screen.getByText("Password updated successfully.")).toBeInTheDocument();
      });
    });

    test("closes modal when Cancel is clicked", async () => {
      renderDashboard();
      const user = userEvent.setup();
      await login(user);
      await user.click(screen.getByRole("button", { name: /change password/i }));
      // Use exact string to avoid matching the "Cancelled" stat card button
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("heading", { name: /change password/i })).not.toBeInTheDocument();
    });
  });
});
