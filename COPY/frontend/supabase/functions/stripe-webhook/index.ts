import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function toIsoOrNull(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

async function getUserIdByCustomerId(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`customer lookup failed: ${error.message}`);
  }

  return data?.user_id ?? null;
}

async function upsertUserSubscription(params: {
  userId: string;
  customerId: string;
  subscriptionId: string | null;
  priceId: string | null;
  status: string | null;
  trialStart: number | null;
  trialEnd: number | null;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean | null;
  canceledAt: number | null;
}) {
  const payload = {
    user_id: params.userId,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    stripe_price_id: params.priceId,
    status: params.status ?? "trialing",
    trial_started_at: toIsoOrNull(params.trialStart),
    trial_ends_at: toIsoOrNull(params.trialEnd),
    current_period_start: toIsoOrNull(params.currentPeriodStart),
    current_period_end: toIsoOrNull(params.currentPeriodEnd),
    cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
    canceled_at: toIsoOrNull(params.canceledAt),
  };

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    throw new Error(`user_subscriptions upsert failed: ${error.message}`);
  }
}

async function syncStripeSubscription(subscription: Stripe.Subscription, forcedUserId?: string | null) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    throw new Error("Missing Stripe customer id on subscription");
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;

  let userId =
    forcedUserId ||
    subscription.metadata?.supabase_user_id ||
    null;

  if (!userId) {
    userId = await getUserIdByCustomerId(customerId);
  }

  if (!userId) {
    return;
  }

  await upsertUserSubscription({
    userId,
    customerId,
    subscriptionId: subscription.id,
    priceId,
    status: subscription.status,
    trialStart: subscription.trial_start,
    trialEnd: subscription.trial_end,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Missing webhook secret or stripe-signature header" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription" && session.subscription && session.customer) {
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer.id;

          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const userId =
            session.client_reference_id ||
            session.metadata?.supabase_user_id ||
            null;

          if (!userId) {
            throw new Error("Missing client_reference_id / supabase_user_id on checkout session");
          }

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          await upsertUserSubscription({
            userId,
            customerId,
            subscriptionId: subscription.id,
            priceId: subscription.items.data[0]?.price?.id ?? null,
            status: subscription.status,
            trialStart: subscription.trial_start,
            trialEnd: subscription.trial_end,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at,
          });
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});