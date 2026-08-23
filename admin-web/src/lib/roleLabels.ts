/**
 * Human-readable labels for Role.name (backend apps.accounts.constants
 * ROLE_CHOICES). Single source — previously duplicated with slightly
 * different wording across the Users page, UserForm, and
 * SignupRequestActions.
 */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  van_salesman: "Van Salesman / Field Sales Executive",
  pre_sales_order_booker: "Pre-Sales / Order Booker",
  sales_supervisor: "Sales Supervisor / Area Sales Manager",
  back_office_admin: "Admin (Back-Office)",
  finance_accounts: "Finance / Accounts User",
  fleet_manager: "Fleet / Transport Manager",
  system_it_admin: "IT Head (System/IT Administrator)",
};
