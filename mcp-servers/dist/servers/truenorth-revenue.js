import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const server = new McpServer({
    name: "truenorth-revenue",
    version: "0.1.0",
});
// ── Stripe helpers ───────────────────────────────────────────────────
function getStripeConfig() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey)
        throw new Error("Missing STRIPE_SECRET_KEY env var");
    return { apiKey };
}
async function stripeGet(path) {
    const { apiKey } = getStripeConfig();
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Stripe API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
}
async function stripeList(path, params) {
    const all = [];
    let startingAfter;
    while (true) {
        const p = new URLSearchParams({ limit: "100", ...params });
        if (startingAfter)
            p.set("starting_after", startingAfter);
        const res = await stripeGet(`${path}?${p.toString()}`);
        all.push(...res.data);
        if (!res.has_more || res.data.length === 0)
            break;
        startingAfter = res.data[res.data.length - 1].id;
    }
    return all;
}
// ── get_mrr_summary ──────────────────────────────────────────────────
server.tool("get_mrr_summary", "Get current MRR breakdown by product, plus net-new and churn MRR over the last 30 days", {}, async () => {
    try {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
        // Active subscriptions for total MRR
        const activeSubs = await stripeList("/subscriptions", { status: "active" });
        const byProduct = {};
        let totalMrr = 0;
        for (const sub of activeSubs) {
            for (const item of sub.items?.data ?? []) {
                const amount = (item.plan?.amount ?? 0) * (item.quantity ?? 1);
                const interval = item.plan?.interval;
                let monthlyAmount = amount;
                if (interval === "year")
                    monthlyAmount = Math.round(amount / 12);
                else if (interval === "week")
                    monthlyAmount = Math.round(amount * 52 / 12);
                else if (interval === "day")
                    monthlyAmount = Math.round(amount * 365 / 12);
                const name = item.plan?.nickname || item.plan?.product || "Unknown";
                if (!byProduct[name])
                    byProduct[name] = { mrr: 0, count: 0 };
                byProduct[name].mrr += monthlyAmount;
                byProduct[name].count += 1;
                totalMrr += monthlyAmount;
            }
        }
        // Net new MRR (subs created in last 30 days)
        let netNewMrr = 0;
        for (const sub of activeSubs) {
            if (sub.created >= thirtyDaysAgo) {
                for (const item of sub.items?.data ?? []) {
                    const amount = (item.plan?.amount ?? 0) * (item.quantity ?? 1);
                    const interval = item.plan?.interval;
                    let monthlyAmount = amount;
                    if (interval === "year")
                        monthlyAmount = Math.round(amount / 12);
                    else if (interval === "week")
                        monthlyAmount = Math.round(amount * 52 / 12);
                    else if (interval === "day")
                        monthlyAmount = Math.round(amount * 365 / 12);
                    netNewMrr += monthlyAmount;
                }
            }
        }
        // Churn MRR (canceled in last 30 days)
        const canceledSubs = await stripeList("/subscriptions", { status: "canceled" });
        let churnMrr = 0;
        for (const sub of canceledSubs) {
            if (sub.canceled_at && sub.canceled_at >= thirtyDaysAgo) {
                for (const item of sub.items?.data ?? []) {
                    const amount = (item.plan?.amount ?? 0) * (item.quantity ?? 1);
                    const interval = item.plan?.interval;
                    let monthlyAmount = amount;
                    if (interval === "year")
                        monthlyAmount = Math.round(amount / 12);
                    else if (interval === "week")
                        monthlyAmount = Math.round(amount * 52 / 12);
                    else if (interval === "day")
                        monthlyAmount = Math.round(amount * 365 / 12);
                    churnMrr += monthlyAmount;
                }
            }
        }
        const result = {
            total_mrr: totalMrr,
            by_product: Object.entries(byProduct).map(([name, v]) => ({
                name,
                mrr: v.mrr,
                count: v.count,
            })),
            net_new_mrr_30d: netNewMrr,
            churn_mrr_30d: churnMrr,
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});
// ── list_subscription_events ─────────────────────────────────────────
server.tool("list_subscription_events", "List recent subscription-related events (creates, updates, cancellations)", {
    days: z.number().optional().describe("Lookback window in days (default: 7)"),
    limit: z.number().optional().describe("Max events to return (default: 25)"),
}, async ({ days, limit }) => {
    try {
        const lookbackDays = days ?? 7;
        const maxResults = limit ?? 25;
        const since = Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60;
        const res = await stripeGet(`/events?created[gte]=${since}&limit=100`);
        const subEvents = res.data
            .filter((e) => e.type.includes("customer.subscription"))
            .slice(0, maxResults);
        const result = subEvents.map((e) => {
            const obj = e.data?.object ?? {};
            let amountCents = 0;
            for (const item of obj.items?.data ?? []) {
                amountCents += (item.plan?.amount ?? 0) * (item.quantity ?? 1);
            }
            return {
                event_type: e.type,
                created_at: new Date(e.created * 1000).toISOString(),
                customer_email: obj.customer_email || obj.customer || null,
                product: obj.items?.data?.[0]?.plan?.nickname || obj.items?.data?.[0]?.plan?.product || null,
                amount_cents: amountCents,
            };
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});
// ── get_churn_analysis ───────────────────────────────────────────────
server.tool("get_churn_analysis", "Analyze recently canceled subscriptions with duration and cancel reason", {
    days: z.number().optional().describe("Lookback window in days (default: 30)"),
}, async ({ days }) => {
    try {
        const lookbackDays = days ?? 30;
        const since = Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60;
        const canceledSubs = await stripeList("/subscriptions", { status: "canceled" });
        const recent = canceledSubs.filter((sub) => sub.canceled_at && sub.canceled_at >= since);
        const result = recent.map((sub) => {
            const createdAt = sub.created;
            const canceledAt = sub.canceled_at;
            const durationDays = Math.round((canceledAt - createdAt) / (24 * 60 * 60));
            let amountCents = 0;
            for (const item of sub.items?.data ?? []) {
                amountCents += (item.plan?.amount ?? 0) * (item.quantity ?? 1);
            }
            return {
                subscription_id: sub.id,
                canceled_at: new Date(canceledAt * 1000).toISOString(),
                created_at: new Date(createdAt * 1000).toISOString(),
                duration_days: durationDays,
                amount_cents: amountCents,
                product: sub.items?.data?.[0]?.plan?.nickname || sub.items?.data?.[0]?.plan?.product || null,
                cancel_reason: sub.cancellation_details?.reason || sub.cancel_reason || null,
            };
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});
// ── list_failed_charges ──────────────────────────────────────────────
server.tool("list_failed_charges", "List recent failed or incomplete charges for dunning and recovery analysis", {
    days: z.number().optional().describe("Lookback window in days (default: 7)"),
    limit: z.number().optional().describe("Max results (default: 25)"),
}, async ({ days, limit }) => {
    try {
        const lookbackDays = days ?? 7;
        const maxResults = limit ?? 25;
        const since = Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60;
        const res = await stripeGet(`/charges?created[gte]=${since}&limit=100`);
        const failed = res.data
            .filter((c) => c.status !== "succeeded")
            .slice(0, maxResults);
        const result = failed.map((c) => ({
            id: c.id,
            amount_cents: c.amount,
            currency: c.currency,
            status: c.status,
            failure_code: c.failure_code || null,
            failure_message: c.failure_message || null,
            customer: c.customer || null,
            created_at: new Date(c.created * 1000).toISOString(),
        }));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});
// ── get_revenue_by_product ───────────────────────────────────────────
server.tool("get_revenue_by_product", "Break down revenue by product from paid invoices over a given period", {
    months: z.number().optional().describe("Lookback window in months (default: 1)"),
}, async ({ months }) => {
    try {
        const lookbackMonths = months ?? 1;
        const since = Math.floor(Date.now() / 1000) - lookbackMonths * 30 * 24 * 60 * 60;
        const invoices = await stripeList("/invoices", {
            status: "paid",
            "created[gte]": String(since),
        });
        const byProduct = {};
        let totalRevenue = 0;
        for (const inv of invoices) {
            for (const line of inv.lines?.data ?? []) {
                const name = line.description || line.price?.product || "Unknown";
                const amount = line.amount ?? 0;
                if (!byProduct[name])
                    byProduct[name] = { revenue_cents: 0, invoice_count: 0 };
                byProduct[name].revenue_cents += amount;
                byProduct[name].invoice_count += 1;
                totalRevenue += amount;
            }
        }
        const result = {
            total_revenue_cents: totalRevenue,
            by_product: Object.entries(byProduct).map(([name, v]) => ({
                name,
                revenue_cents: v.revenue_cents,
                invoice_count: v.invoice_count,
            })),
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});
// ── get_customer_cohort ──────────────────────────────────────────────
server.tool("get_customer_cohort", "Cohort analysis showing signups per month and their retention rates", {
    months: z.number().optional().describe("Lookback window in months (default: 6)"),
}, async ({ months }) => {
    try {
        const lookbackMonths = months ?? 6;
        const since = Math.floor(Date.now() / 1000) - lookbackMonths * 30 * 24 * 60 * 60;
        const subs = await stripeList("/subscriptions", {
            status: "all",
            "created[gte]": String(since),
        });
        const cohorts = {};
        for (const sub of subs) {
            const date = new Date(sub.created * 1000);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            if (!cohorts[month])
                cohorts[month] = { total: 0, active: 0 };
            cohorts[month].total += 1;
            if (sub.status === "active")
                cohorts[month].active += 1;
        }
        const result = {
            cohorts: Object.entries(cohorts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, v]) => ({
                month,
                total_signups: v.total,
                still_active: v.active,
                churned: v.total - v.active,
                retention_pct: v.total > 0 ? Math.round((v.active / v.total) * 10000) / 100 : 0,
            })),
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});
// ── Start server ─────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("truenorth-revenue MCP server running on stdio");
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
