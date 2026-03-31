"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import type { KpiIntegration, IntegrationType } from "@/types/database";

interface Kpi {
  id: string;
  name: string;
  unit: string | null;
  organization_id: string;
}

// ============================================================
// Integration type labels and metric options
// ============================================================

const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  stripe: "Stripe",
  convertkit: "ConvertKit",
  beehiiv: "Beehiiv",
  discourse: "Discourse",
  webhook: "Webhook",
  csv: "CSV Import",
};

const STRIPE_METRICS = [
  { value: "mrr", label: "Monthly Recurring Revenue" },
  { value: "active_customers", label: "Active Customers" },
  { value: "churn_rate", label: "Churn Rate (%)" },
  { value: "revenue", label: "Available Revenue" },
  { value: "ltm_revenue", label: "LTM Revenue" },
];

const CONVERTKIT_METRICS = [
  { value: "subscriber_count", label: "Subscriber Count" },
  { value: "open_rate", label: "Open Rate (%)" },
  { value: "click_rate", label: "Click Rate (%)" },
];

const BEEHIIV_METRICS = [
  { value: "subscriber_count", label: "Subscriber Count" },
  { value: "open_rate", label: "Open Rate (%)" },
  { value: "click_rate", label: "Click Rate (%)" },
];

const DISCOURSE_METRICS = [
  { value: "user_count", label: "Total Users" },
  { value: "wau_over_mau", label: "WAU/MAU Ratio (%)" },
  { value: "active_users_7_days", label: "Weekly Active Users" },
  { value: "active_users_30_days", label: "Monthly Active Users" },
  { value: "topics_7_days", label: "New Topics (7 days)" },
  { value: "posts_7_days", label: "New Posts (7 days)" },
  { value: "likes_7_days", label: "Likes (7 days)" },
  { value: "dau", label: "Daily Active Users (admin)" },
  { value: "posts_with_2_replies_24h", label: "% Posts with ≥2 Replies in 24h" },
  { value: "median_ttfr_hours", label: "Median Time to First Reply (hours)" },
];

function generateWebhookToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random token generation is unavailable in this browser.");
  }

  const bytes = new Uint8Array(48);
  cryptoApi.getRandomValues(bytes);

  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

// ============================================================
// Integration Row
// ============================================================

function IntegrationRow({
  integration,
  onRefresh,
}: {
  integration: KpiIntegration;
  onRefresh: () => void;
}) {
  const supabase = createClient();
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const statusColor =
    integration.last_sync_status === "success"
      ? "green"
      : integration.last_sync_status === "error"
        ? "red"
        : "neutral";

  async function handleToggle(enabled: boolean) {
    setToggling(true);
    await supabase
      .from("kpi_integrations")
      .update({ enabled })
      .eq("id", integration.id);
    setToggling(false);
    onRefresh();
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/kpi/sync-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: integration.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.error("Sync failed:", res.status, body);
      }
    } catch (err) {
      console.error("Sync request failed:", err);
    }
    setSyncing(false);
    onRefresh();
  }

  async function handleDelete() {
    if (!confirm("Remove this integration?")) return;
    await supabase
      .from("kpi_integrations")
      .delete()
      .eq("id", integration.id);
    onRefresh();
  }

  const webhookUrl =
    integration.integration_type === "webhook"
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/kpi/webhook`
      : null;

  const webhookToken =
    integration.integration_type === "webhook"
      ? ((integration.config as Record<string, unknown>).webhook_token as string)
      : null;

  return (
    <div className="border border-line rounded-lg p-4 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {INTEGRATION_LABELS[integration.integration_type as IntegrationType] ??
              integration.integration_type}
          </span>
          {integration.last_sync_status && (
            <Badge status={statusColor}>
              {integration.last_sync_status}
            </Badge>
          )}
        </div>
        <Toggle
          checked={integration.enabled}
          onChange={handleToggle}
          disabled={toggling}
        />
      </div>

      {integration.last_sync_at && (
        <p className="text-xs text-subtle mb-1">
          Last sync: {new Date(integration.last_sync_at).toLocaleString()}
        </p>
      )}
      {integration.last_sync_error && (
        <p className="text-xs text-semantic-brick mb-1">
          Error: {integration.last_sync_error}
        </p>
      )}

      {/* Webhook-specific info */}
      {webhookUrl && webhookToken && (
        <div className="mt-2 p-2 rounded bg-canvas text-xs font-mono space-y-1">
          <p>
            <span className="text-subtle">URL:</span> {webhookUrl}
          </p>
          <p>
            <span className="text-subtle">Token:</span> {webhookToken}
          </p>
          <button
            type="button"
            className="text-accent underline text-xs"
            onClick={() => navigator.clipboard.writeText(`Bearer ${webhookToken}`)}
          >
            Copy bearer token
          </button>
        </div>
      )}

      {/* Config summary */}
      {integration.integration_type !== "webhook" &&
        integration.integration_type !== "csv" && (
          <p className="text-xs text-subtle mt-1">
            Metric: {(integration.config as Record<string, unknown>).metric as string}
          </p>
        )}

      <div className="flex gap-2 mt-3">
        {integration.integration_type !== "webhook" &&
          integration.integration_type !== "csv" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncNow}
              loading={syncing}
            >
              Sync Now
            </Button>
          )}
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Remove
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Add Integration Form
// ============================================================

function AddIntegrationForm({
  kpiId,
  onAdded,
}: {
  kpiId: string;
  onAdded: () => void;
}) {
  const supabase = createClient();
  const [type, setType] = useState<IntegrationType>("stripe");
  const [apiKey, setApiKey] = useState("");
  const [metric, setMetric] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiUsername, setApiUsername] = useState("system");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setApiKey("");
    setMetric("");
    setPublicationId("");
    setBaseUrl("");
    setApiUsername("system");
  }

  async function handleSave() {
    setSaving(true);

    let config: Record<string, unknown> = {};

    switch (type) {
      case "stripe":
        config = { apiKey, metric: metric || "mrr" };
        break;
      case "convertkit":
        config = { apiKey, metric: metric || "subscriber_count" };
        break;
      case "beehiiv":
        config = { apiKey, publicationId, metric: metric || "subscriber_count" };
        break;
      case "discourse":
        config = {
          apiKey,
          apiUsername: apiUsername || "system",
          baseUrl,
          metric: metric || "user_count",
        };
        break;
      case "webhook":
        config = { webhook_token: generateWebhookToken() };
        break;
      case "csv":
        // CSV is handled separately (file upload), not stored as persistent integration
        setSaving(false);
        return;
    }

    await supabase.from("kpi_integrations").insert({
      kpi_id: kpiId,
      integration_type: type,
      config,
      enabled: true,
    });

    resetForm();
    setSaving(false);
    onAdded();
  }

  const metricOptions =
    type === "stripe"
      ? STRIPE_METRICS
      : type === "convertkit"
        ? CONVERTKIT_METRICS
        : type === "beehiiv"
          ? BEEHIIV_METRICS
          : type === "discourse"
            ? DISCOURSE_METRICS
            : [];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-accent">Add Integration</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select
          label="Integration Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as IntegrationType);
            resetForm();
          }}
        >
          <option value="stripe">Stripe</option>
          <option value="convertkit">ConvertKit</option>
          <option value="beehiiv">Beehiiv</option>
          <option value="discourse">Discourse</option>
          <option value="webhook">Webhook (incoming)</option>
        </Select>

        {/* Type-specific config fields */}
        {(type === "stripe" || type === "convertkit" || type === "beehiiv" || type === "discourse") && (
          <>
            <Input
              label="API Key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                type === "stripe"
                  ? "sk_live_..."
                  : type === "convertkit"
                    ? "ConvertKit API secret"
                    : "Beehiiv API key"
              }
            />
            {metricOptions.length > 0 && (
              <Select
                label="Metric"
                value={metric || metricOptions[0].value}
                onChange={(e) => setMetric(e.target.value)}
              >
                {metricOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          </>
        )}

        {type === "beehiiv" && (
          <Input
            label="Publication ID"
            value={publicationId}
            onChange={(e) => setPublicationId(e.target.value)}
            placeholder="pub_..."
          />
        )}

        {type === "discourse" && (
          <>
            <Input
              label="Forum URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://forum.example.com"
            />
            <Input
              label="API Username"
              value={apiUsername}
              onChange={(e) => setApiUsername(e.target.value)}
              placeholder="system"
            />
          </>
        )}

        {type === "webhook" && (
          <p className="text-xs text-subtle">
            A unique webhook token will be auto-generated. After saving, you will
            see the URL and token to use with external services.
          </p>
        )}

        <Button
          onClick={handleSave}
          loading={saving}
          disabled={
            saving ||
            ((type === "stripe" || type === "convertkit" || type === "beehiiv" || type === "discourse") && !apiKey) ||
            (type === "beehiiv" && !publicationId) ||
            (type === "discourse" && !baseUrl)
          }
        >
          Save Integration
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// CSV Import Section
// ============================================================

function CsvImportSection({ kpiId }: { kpiId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kpi_id", kpiId);

    try {
      const res = await fetch("/api/kpi/import-csv", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Imported ${data.imported} entries.`);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult("Import failed.");
    }
    setImporting(false);
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-accent">CSV Import</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-subtle">
          Upload a CSV with &quot;date&quot; and &quot;value&quot; columns to bulk import
          historical data points.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent/90"
        />
        <Button
          onClick={handleImport}
          loading={importing}
          variant="secondary"
        >
          Import CSV
        </Button>
        {result && (
          <p
            className={`text-xs ${
              result.startsWith("Error") ? "text-semantic-brick" : "text-semantic-green"
            }`}
          >
            {result}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main View
// ============================================================

export function IntegrationsView({
  kpi,
  integrations: initialIntegrations,
}: {
  kpi: Kpi;
  integrations: KpiIntegration[];
}) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);

  // We use initialIntegrations and rely on router.refresh() for updates
  const integrations = initialIntegrations;

  function handleRefresh() {
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => router.push(`/strategy/scoreboard/${kpi.id}`)}
        >
          Back to KPI
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Integrations</h1>
          <p className="text-sm text-subtle">{kpi.name}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "Add Integration"}
        </Button>
      </div>

      {showAddForm && (
        <div className="mb-6">
          <AddIntegrationForm
            kpiId={kpi.id}
            onAdded={() => {
              setShowAddForm(false);
              handleRefresh();
            }}
          />
        </div>
      )}

      {/* Existing integrations */}
      {integrations.length > 0 ? (
        <div className="space-y-3 mb-6">
          {integrations.map((integration) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 mb-6">
          <p className="text-sm text-subtle">
            No integrations configured yet.
          </p>
          <p className="text-xs text-subtle mt-1">
            Add a Stripe, ConvertKit, Beehiiv, Discourse, or Webhook integration to
            automatically sync your KPI data.
          </p>
        </div>
      )}

      {/* CSV Import is always visible */}
      <CsvImportSection kpiId={kpi.id} />
    </div>
  );
}
