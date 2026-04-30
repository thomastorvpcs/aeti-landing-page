import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Step1Company from "../../components/form/Step1Company";

const EMPTY_DATA = {
  legalCompanyName: "",
  dba: "",
  ein: "",
  entityType: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  addressCountry: "United States",
  website: "",
  billingAddressStreet: "",
  billingAddressCity: "",
  billingAddressState: "",
  billingAddressZip: "",
  billingAddressCountry: "",
};

function renderStep1({ data = {}, errors = {} } = {}) {
  const onChange = vi.fn();
  render(
    <Step1Company
      data={{ ...EMPTY_DATA, ...data }}
      onChange={onChange}
      errors={errors}
    />
  );
  return { onChange };
}

describe("Step1Company", () => {
  describe("rendering", () => {
    test("renders company information heading", () => {
      renderStep1();
      expect(screen.getByRole("heading", { name: /company information/i })).toBeInTheDocument();
    });

    test("renders all required input fields", () => {
      renderStep1();
      expect(screen.getByPlaceholderText("Acme Technologies LLC")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("12-3456789")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("123 Main Street, Suite 400")).toBeInTheDocument();
    });

    test("renders entity type dropdown with placeholder option", () => {
      renderStep1();
      expect(screen.getByRole("combobox", { name: /entity type/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /select entity type/i })).toBeInTheDocument();
    });

    test("renders all US entity type options", () => {
      renderStep1();
      const select = screen.getByRole("combobox", { name: /entity type/i });
      expect(select).toContainElement(screen.getByRole("option", { name: "LLC" }));
      expect(select).toContainElement(screen.getByRole("option", { name: "C-Corp" }));
      expect(select).toContainElement(screen.getByRole("option", { name: "Non-profit" }));
    });

    test("country field is read-only and shows United States", () => {
      renderStep1();
      const country = screen.getByDisplayValue("United States");
      expect(country).toHaveAttribute("readonly");
    });

    test("billing address fields hidden by default", () => {
      renderStep1();
      expect(screen.queryByPlaceholderText("123 Main Street, Suite 400")).toBeInTheDocument();
      // Only one street address field — the billing one is hidden
      expect(screen.getAllByPlaceholderText("123 Main Street, Suite 400")).toHaveLength(1);
    });
  });

  describe("error display", () => {
    test("shows error message for legalCompanyName", () => {
      renderStep1({ errors: { legalCompanyName: "Legal company name is required." } });
      expect(screen.getByText("Legal company name is required.")).toBeInTheDocument();
    });

    test("shows error message for invalid EIN", () => {
      renderStep1({ errors: { ein: "EIN must be in XX-XXXXXXX or XXXXXXXXX format (9 digits)." } });
      expect(screen.getByText("EIN must be in XX-XXXXXXX or XXXXXXXXX format (9 digits).")).toBeInTheDocument();
    });

    test("marks field as aria-invalid when error present", () => {
      renderStep1({ errors: { legalCompanyName: "Required" } });
      expect(screen.getByPlaceholderText("Acme Technologies LLC")).toHaveAttribute("aria-invalid", "true");
    });

    test("field has no aria-invalid when no error", () => {
      renderStep1();
      expect(screen.getByPlaceholderText("Acme Technologies LLC")).toHaveAttribute("aria-invalid", "false");
    });
  });

  describe("billing address toggle", () => {
    test("billing fields appear when same-as-business is unchecked", async () => {
      renderStep1();
      const user = userEvent.setup();
      await user.click(screen.getByRole("checkbox", { name: /same as business address/i }));
      expect(screen.getByLabelText(/billing street address/i)).toBeInTheDocument();
    });

    test("billing fields disappear when same-as-business is re-checked", async () => {
      renderStep1();
      const user = userEvent.setup();
      await user.click(screen.getByRole("checkbox", { name: /same as business address/i }));
      await user.click(screen.getByRole("checkbox", { name: /same as business address/i }));
      expect(screen.queryByLabelText(/billing street address/i)).not.toBeInTheDocument();
    });

    test("re-checking same-as-business clears billing field values via onChange", async () => {
      const { onChange } = renderStep1();
      const user = userEvent.setup();
      await user.click(screen.getByRole("checkbox", { name: /same as business address/i }));
      await user.click(screen.getByRole("checkbox", { name: /same as business address/i }));
      expect(onChange).toHaveBeenCalledWith("billingAddressStreet", "");
      expect(onChange).toHaveBeenCalledWith("billingAddressCity", "");
      expect(onChange).toHaveBeenCalledWith("billingAddressZip", "");
    });
  });

  describe("field interaction", () => {
    test("calls onChange with field name and value when user types", async () => {
      const { onChange } = renderStep1();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Acme Technologies LLC"), "A");
      expect(onChange).toHaveBeenCalledWith("legalCompanyName", "A");
    });

    test("calls onChange when entity type is selected", async () => {
      const { onChange } = renderStep1();
      const user = userEvent.setup();
      await user.selectOptions(
        screen.getByRole("combobox", { name: /entity type/i }),
        "LLC"
      );
      expect(onChange).toHaveBeenCalledWith("entityType", "LLC");
    });
  });
});
