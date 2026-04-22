import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const FULL_ACCESS_STATUSES = new Set(["trialing", "active"]);
const RESTRICTED_STATUSES = new Set(["past_due", "canceled", "expired"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function normalizeSubscription(row: any) {
  if (!row) {
    return {
      status: "expired",
      access: "restricted",
      isRestricted: true,
      expiresAt: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
    };
  }

  const status = String(row.status || "").toLowerCase().trim();
  const now = Date.now();
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;
  const currentPeriodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : null;

  let normalizedStatus = status || "expired";

  if (normalizedStatus === "trialing" && trialEndsAt && trialEndsAt < now) {
    normalizedStatus = "expired";
  }

  if (
    (normalizedStatus === "past_due" || normalizedStatus === "canceled") &&
    currentPeriodEnd &&
    currentPeriodEnd < now
  ) {
    normalizedStatus = "expired";
  }

  const hasFullAccess = FULL_ACCESS_STATUSES.has(normalizedStatus);
  const isRestricted = !hasFullAccess || RESTRICTED_STATUSES.has(normalizedStatus);

  return {
    status: normalizedStatus,
    access: hasFullAccess ? "full" : "restricted",
    isRestricted,
    expiresAt: normalizedStatus === "trialing" ? trialEndsAt : currentPeriodEnd,
    trialEndsAt,
    currentPeriodEnd,
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return json({ error: "Missing bearer token" }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return json({ error: userError?.message || "Unauthorized" }, { status: 401 });
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("status, trial_ends_at, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      return json({ error: subscriptionError.message }, { status: 500 });
    }

    return json(normalizeSubscription(subscription), { status: 200 });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected access validation failure.",
      },
      { status: 500 }
    );
  }
});
