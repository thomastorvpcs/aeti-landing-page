import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import OnboardingForm from "../../components/form/OnboardingForm";

vi.mock("axios");

vi.mock("../../utils/fileStorage", () => ({
  saveFile: vi.fn().mockResolvedValue(undefined),
  loadFile: vi.fn().mockResolvedValue(null),
  removeFile: vi.fn().mockResolvedValue(undefined),
  clearFiles: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  sessionStorage.clear();
});

function renderForm() {
  render(<OnboardingForm />);
}

async function fillStep1(user) {
  await user.type(screen.getByPlaceholderText("Acme Technologies LLC"), "Acme Corp");
  await user.type(screen.getByPlaceholderText("12-3456789"), "12-3456789");
  // Use fireEvent.change for <select> elements — more reliable in jsdom than userEvent.selectOptions
  fireEvent.change(screen.getByLabelText(/entity type/i), { target: { value: "LLC" } });
  await user.type(screen.getByPlaceholderText("123 Main Street, Suite 400"), "123 Main St");
  await user.type(screen.getByPlaceholderText("New York"), "Austin");
  fireEvent.change(screen.getByLabelText(/^state/i), { target: { value: "TX" } });
  await user.type(screen.getByPlaceholderText("10001"), "78701");
}

describe("OnboardingForm", () => {
  describe("step 1 — company validation", () => {
    test("shows step 1 heading on initial render", () => {
      renderForm();
      expect(screen.getByRole("heading", { name: /company information/i })).toBeInTheDocument();
    });

    test("shows validation errors when Continue is clicked with empty fields", async () => {
      renderForm();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue/i }));
      expect(screen.getByText("Legal company name is required.")).toBeInTheDocument();
      expect(screen.getByText("EIN / Tax ID is required.")).toBeInTheDocument();
      expect(screen.getByText("Please select an entity type.")).toBeInTheDocument();
      expect(screen.getByText("Street address is required.")).toBeInTheDocument();
    });

    test("shows EIN format error for invalid EIN", async () => {
      renderForm();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("12-3456789"), "invalid");
      await user.click(screen.getByRole("button", { name: /continue/i }));
      expect(screen.getByText(/EIN must be in XX-XXXXXXX/i)).toBeInTheDocument();
    });

    test("accepts EIN with dashes and advances to step 2", async () => {
      renderForm();
      const user = userEvent.setup();
      await fillStep1(user);
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /contact details/i })).toBeInTheDocument();
      });
    });

    test("accepts EIN without dashes and advances to step 2", async () => {
      renderForm();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Acme Technologies LLC"), "Acme Corp");
      await user.type(screen.getByPlaceholderText("12-3456789"), "123456789");
      fireEvent.change(screen.getByLabelText(/entity type/i), { target: { value: "LLC" } });
      await user.type(screen.getByPlaceholderText("123 Main Street, Suite 400"), "123 Main St");
      await user.type(screen.getByPlaceholderText("New York"), "Austin");
      fireEvent.change(screen.getByLabelText(/^state/i), { target: { value: "TX" } });
      await user.type(screen.getByPlaceholderText("10001"), "78701");
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /contact details/i })).toBeInTheDocument();
      });
    });

    test("clears field error once user starts typing", async () => {
      renderForm();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByText("Legal company name is required.")).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText("Acme Technologies LLC"), "A");
      await waitFor(() => {
        expect(screen.queryByText("Legal company name is required.")).not.toBeInTheDocument();
      });
    });
  });

  describe("step 2 — contact validation", () => {
    beforeEach(async () => {
      renderForm();
      const user = userEvent.setup();
      await fillStep1(user);
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /contact details/i })).toBeInTheDocument();
      });
    });

    test("shows validation errors for missing contact fields", async () => {
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByText("First name is required.")).toBeInTheDocument();
      });
      expect(screen.getByText("Last name is required.")).toBeInTheDocument();
      expect(screen.getByText("Phone number is required.")).toBeInTheDocument();
    });

    test("shows error for invalid contact email format", async () => {
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("jane@acme.com"), "not-an-email");
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
      });
    });

    test("shows email required error when email is empty", async () => {
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Jane"), "Jane");
      await user.type(screen.getByPlaceholderText("Smith"), "Smith");
      await user.type(screen.getByPlaceholderText("+1 (555) 000-0000"), "5125551234");
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByText("Email is required.")).toBeInTheDocument();
      });
    });

    test("Back button returns to step 1", async () => {
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /back/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /company information/i })).toBeInTheDocument();
      });
    });
  });

  describe("progress indicator", () => {
    test("shows step 1 active on initial render", () => {
      renderForm();
      // aria-current="step" is on the indicator div inside the <li>, not on the <li> itself
      expect(document.querySelector('[aria-current="step"]')).toBeInTheDocument();
      expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("1");
    });
  });
});
