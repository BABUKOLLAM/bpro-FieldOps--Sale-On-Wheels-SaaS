import { apiGet } from "@/lib/api";
import ChangeRequestRow, { type ChangeRequest } from "../roles/ChangeRequestRow";
import SettingsCard from "./SettingsCard";
import WebhookCreateForm from "./WebhookCreateForm";
import WebhookActions from "./WebhookActions";
import LogoUploadForm from "./LogoUploadForm";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Paginated<T> = { count: number; results: T[] };

type GSTRegistration = {
  id: string;
  company: string;
  state: string;
  gstin: string;
  address_line1: string;
  address_line2: string;
  city: string;
  pincode: string;
  is_default: boolean;
};

type Company = {
  id: string;
  legal_name: string;
  display_name: string;
  fy_start_month: number;
  is_active: boolean;
  upi_vpa: string;
  logo: string | null;
  gst_registrations: GSTRegistration[];
};

type ERPConnection = {
  id: string;
  erp_type: string;
  sync_mode: string;
  batch_interval_minutes: number;
  is_active: boolean;
};

type PaymentGatewayConnection = { id: string; gateway_type: string; is_active: boolean };

type Webhook = { id: string; name: string; url: string; event_types: string[]; is_active: boolean };

type NotificationGatewaySettings = {
  id: string;
  sms_gateway_url: string;
  whatsapp_phone_number_id: string;
  has_fcm_server_key: boolean;
  has_sms_gateway_api_key: boolean;
  has_whatsapp_access_token: boolean;
};

type MessageTemplate = {
  id: string;
  key: string;
  key_display: string;
  title_template: string;
  body_template: string;
};

type EwayBillSettings = {
  id: string;
  threshold_amount: string;
  is_active: boolean;
};

export default async function MasterSettingsPage() {
  const [
    companies, erpConnections, paymentConnections, webhooks, notificationGateway, messageTemplates,
    ewayBillSettings, pending,
  ] =
    await Promise.all([
      apiGet<Paginated<Company>>("/api/company/companies/"),
      apiGet<Paginated<ERPConnection>>("/api/integrations/erp-connections/"),
      apiGet<Paginated<PaymentGatewayConnection>>("/api/payments/gateway-connections/"),
      apiGet<Paginated<Webhook>>("/api/integrations/webhooks/"),
      apiGet<Paginated<NotificationGatewaySettings>>("/api/notifications/gateway-settings/"),
      apiGet<Paginated<MessageTemplate>>("/api/notifications/message-templates/"),
      apiGet<Paginated<EwayBillSettings>>("/api/sales/eway-bill-settings/"),
      apiGet<Paginated<ChangeRequest>>("/api/governance/change-requests/?status=pending").catch(
        () => ({ count: 0, results: [] }) as Paginated<ChangeRequest>
      ),
    ]);

  const company = companies.results[0];
  const gatewaySettings = notificationGateway.results[0];
  const ewayBill = ewayBillSettings.results[0];
  const logoUrl = company?.logo
    ? company.logo.startsWith("http")
      ? company.logo
      : `${API_BASE_URL}/${company.logo.replace(/^\//, "")}`
    : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Master Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Company profile, GST registrations, ERP/payment connections, webhooks, and notification gateways — every
          edit here goes through the same Super Admin/Admin/IT Head approval as Roles.
        </p>
      </div>

      {pending.results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Pending changes ({pending.results.length})
          </h2>
          <div className="space-y-2">
            {pending.results.map((changeRequest) => (
              <ChangeRequestRow key={changeRequest.id} changeRequest={changeRequest} />
            ))}
          </div>
        </div>
      )}

      {company && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Company Profile</h2>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Logo — shown on the GST invoice PDF header. Uploaded directly, not via approval.
            </p>
            <LogoUploadForm companyId={company.id} currentLogoUrl={logoUrl} />
          </div>
          <SettingsCard
            title={company.display_name || company.legal_name}
            subtitle={`FY starts month ${company.fy_start_month} · ${company.is_active ? "Active" : "Inactive"}`}
            targetType="company"
            targetId={company.id}
            fields={[
              { name: "legal_name", label: "Legal name", type: "text", value: company.legal_name },
              { name: "display_name", label: "Display name", type: "text", value: company.display_name },
              { name: "fy_start_month", label: "FY start month (1-12)", type: "number", value: company.fy_start_month },
              {
                name: "upi_vpa", label: "UPI VPA (payee ID for point-of-sale QR codes)", type: "text",
                value: company.upi_vpa,
              },
              { name: "is_active", label: "Active", type: "boolean", value: company.is_active },
            ]}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          GST Registrations ({company?.gst_registrations.length ?? 0})
        </h2>
        <div className="space-y-3">
          {company?.gst_registrations.map((gst) => (
            <SettingsCard
              key={gst.id}
              title={`${gst.state} — ${gst.gstin}`}
              subtitle={`${gst.city} · ${gst.pincode}${gst.is_default ? " · Default" : ""}`}
              targetType="gst-registration"
              targetId={gst.id}
              fields={[
                { name: "state", label: "State code", type: "text", value: gst.state },
                { name: "gstin", label: "GSTIN", type: "text", value: gst.gstin },
                { name: "address_line1", label: "Address line 1", type: "text", value: gst.address_line1 },
                { name: "address_line2", label: "Address line 2", type: "text", value: gst.address_line2 },
                { name: "city", label: "City", type: "text", value: gst.city },
                { name: "pincode", label: "Pincode", type: "text", value: gst.pincode },
                { name: "is_default", label: "Default registration", type: "boolean", value: gst.is_default },
              ]}
            />
          ))}
          {(!company || company.gst_registrations.length === 0) && (
            <p className="text-sm text-slate-400">No GST registrations yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          ERP Connections ({erpConnections.count})
        </h2>
        <div className="space-y-3">
          {erpConnections.results.map((connection) => (
            <SettingsCard
              key={connection.id}
              title={connection.erp_type}
              subtitle={`${connection.sync_mode} · every ${connection.batch_interval_minutes}m · ${connection.is_active ? "Active" : "Inactive"}`}
              targetType="erp-connection"
              targetId={connection.id}
              fields={[
                { name: "erp_type", label: "ERP type (tally/busy/marg/mock)", type: "text", value: connection.erp_type },
                { name: "sync_mode", label: "Sync mode (realtime/batch)", type: "text", value: connection.sync_mode },
                {
                  name: "batch_interval_minutes", label: "Batch interval (minutes)", type: "number",
                  value: connection.batch_interval_minutes,
                },
                { name: "is_active", label: "Active", type: "boolean", value: connection.is_active },
              ]}
            />
          ))}
          {erpConnections.results.length === 0 && <p className="text-sm text-slate-400">No ERP connection configured.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Payment Gateway Connections ({paymentConnections.count})
        </h2>
        <div className="space-y-3">
          {paymentConnections.results.map((connection) => (
            <SettingsCard
              key={connection.id}
              title={connection.gateway_type}
              subtitle={connection.is_active ? "Active" : "Inactive"}
              targetType="payment-gateway-connection"
              targetId={connection.id}
              fields={[
                { name: "gateway_type", label: "Gateway type (mock/razorpay)", type: "text", value: connection.gateway_type },
                { name: "is_active", label: "Active", type: "boolean", value: connection.is_active },
              ]}
            />
          ))}
          {paymentConnections.results.length === 0 && (
            <p className="text-sm text-slate-400">No payment gateway configured.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Webhooks ({webhooks.count})</h2>
        <div className="space-y-3">
          {webhooks.results.map((webhook) => (
            <SettingsCard
              key={webhook.id}
              title={webhook.name}
              subtitle={webhook.url}
              badges={webhook.event_types}
              targetType="webhook"
              targetId={webhook.id}
              fields={[
                { name: "name", label: "Name", type: "text", value: webhook.name },
                { name: "url", label: "URL", type: "url", value: webhook.url },
                { name: "event_types", label: "Event types (comma-separated)", type: "list", value: webhook.event_types },
                { name: "is_active", label: "Active", type: "boolean", value: webhook.is_active },
              ]}
              extraActions={<WebhookActions webhookId={webhook.id} />}
            />
          ))}
          {webhooks.results.length === 0 && <p className="text-sm text-slate-400">No webhooks yet — add one below.</p>}
        </div>
        <WebhookCreateForm />
      </section>

      {gatewaySettings && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Notification Gateways</h2>
          <SettingsCard
            title="FCM / SMS Gateway"
            subtitle="API keys are Django-admin-only (never shown here) — only the SMS gateway URL is editable via approval."
            badges={[
              gatewaySettings.has_fcm_server_key ? "FCM key configured" : "FCM key not configured",
              gatewaySettings.has_sms_gateway_api_key ? "SMS key configured" : "SMS key not configured",
            ]}
            targetType="notification-gateway-settings"
            targetId={gatewaySettings.id}
            fields={[
              { name: "sms_gateway_url", label: "SMS gateway URL", type: "url", value: gatewaySettings.sms_gateway_url },
            ]}
          />
          <SettingsCard
            title="WhatsApp Business Gateway"
            subtitle="The access token is Django-admin-only (never shown here) — only the phone number ID is editable via approval. Without both configured, WhatsApp sends fall back to a console log (see the audit trail in Django admin)."
            badges={[
              gatewaySettings.has_whatsapp_access_token ? "Access token configured" : "Access token not configured",
            ]}
            targetType="notification-gateway-settings"
            targetId={gatewaySettings.id}
            fields={[
              {
                name: "whatsapp_phone_number_id", label: "WhatsApp phone number ID", type: "text",
                value: gatewaySettings.whatsapp_phone_number_id,
              },
            ]}
          />
        </section>
      )}

      {ewayBill && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">E-way Bill</h2>
          <SettingsCard
            title="Generation threshold"
            subtitle="Invoices at or above this value are flagged as needing an e-way bill on the dashboard. No live government/GSP filing is connected — generated bills are local drafts for manual filing or a GSP bulk-upload."
            targetType="eway-bill-settings"
            targetId={ewayBill.id}
            fields={[
              { name: "threshold_amount", label: "Threshold amount (Rs.)", type: "number", value: Number(ewayBill.threshold_amount) },
              { name: "is_active", label: "Require e-way bills", type: "boolean", value: ewayBill.is_active },
            ]}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Message Templates ({messageTemplates.count})
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Push/SMS wording sent to agents and customers. {"{placeholders}"} like {"{amount}"} or {"{code}"} are
          filled in when a message is actually sent — keep them intact when editing.
        </p>
        <div className="space-y-3">
          {messageTemplates.results.map((template) => (
            <SettingsCard
              key={template.id}
              title={template.key_display}
              subtitle={template.body_template}
              targetType="message-template"
              targetId={template.id}
              fields={[
                { name: "title_template", label: "Title (push notifications only)", type: "text", value: template.title_template },
                { name: "body_template", label: "Body", type: "text", value: template.body_template },
              ]}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
