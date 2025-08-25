// /netlify/functions/buy.js
// Public URLs from Webflow:
//   https://<your-site>.netlify.app/buy?plan=single|1bag|2bag&qty=1
//   (testing) https://<your-site>.netlify.app/buy?sku=PUL-30-SRV&qty=1

// ---- Hard-coded NON-SECRETS ----
const STORE_HASH = 'rctyyem8fp';
const CHANNEL_ID = 1778657;
const API_BASE = `https://api.bigcommerce.com/stores/${STORE_HASH}/v3`;

// ---- SECRET (Netlify env var) ----
const ADMIN_TOKEN = process.env.BC_ADMIN_TOKEN;

// ---- Plan → SKU map (long names + short slugs) ----
const PLAN_TO_SKU = {
  'single order': 'PUL-30-SRV',
  '1 bag subscription': 'PUL-30-SRV-SUB',
  '2 bag subscription': 'PUL-30-SRV-2PAK',
  single: 'PUL-30-SRV',
  '1bag': 'PUL-30-SRV-SUB',
  '2bag': 'PUL-30-SRV-2PAK',
  monthly: 'PUL-30-SRV-SUB',
  double: 'PUL-30-SRV-2PAK',
};

// (Optional) Explicit modifier selections per SKU if you prefer to pin values.
// Example shape:
// const MODS_BY_SKU = {
//   'PUL-30-SRV-SUB': [{ option_id: 123, option_value: 456 }],
//   'PUL-30-SRV-2PAK': [{ option_id: 123, option_value: 456 }],
// };
const MODS_BY_SKU = {};

const norm = (s = '') => s.toLowerCase().trim();

exports.handler = async (event) => {
  try {
    if (!ADMIN_TOKEN) {
      return json({ error: 'Server not configured: missing BC_ADMIN_TOKEN' }, 500);
    }

    const qs = event.queryStringParameters || {};
    const plan = norm(qs.plan);
    const qtyParam = parseInt(qs.qty || '1', 10);
    const skuParam = qs.sku; // allow direct SKU for testing
    const sku = skuParam || PLAN_TO_SKU[plan];

    if (!sku) {
      const options = Object.keys(PLAN_TO_SKU).join(', ');
      return json({ error: `Unknown plan. Try one of: ${options}` }, 400);
    }

    // 1) Variant lookup by SKU (to get product_id + variant_id)
    const vRes = await fetch(
      `${API_BASE}/catalog/variants?sku=${encodeURIComponent(sku)}&include_fields=id,product_id,sku`,
      { headers: { 'X-Auth-Token': ADMIN_TOKEN, 'Accept': 'application/json' } }
    );
    const vJson = await vRes.json();
    if (!vRes.ok || !vJson.data?.length) {
      return json({ error: `SKU not found or unavailable: ${sku}` }, 404);
    }
    const { id: variant_id, product_id } = vJson.data[0];

    // 2) Build modifier selections:
    //    - If you provided explicit choices in MODS_BY_SKU, use those.
    //    - Otherwise, auto-pick each REQUIRED multi-choice modifier's default (or first) value.
    let option_selections = MODS_BY_SKU[sku] || [];
    if (!option_selections.length) {
      option_selections = await getRequiredModifierSelections(product_id, sku);
    }

    // 3) Quantity rules
    const quantity = sku === 'PUL-30-SRV-2PAK'
      ? 1
      : Math.max(1, Number.isFinite(qtyParam) ? qtyParam : 1);

    // 4) Create cart on headless channel and request redirect URLs in one call
    const cRes = await fetch(
      `${API_BASE}/carts?include=redirect_urls`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Token': ADMIN_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          channel_id: CHANNEL_ID,
          line_items: [{
            product_id,
            variant_id,
            quantity,
            // If there are required modifiers, include them
            ...(option_selections.length ? { option_selections } : {}),
          }],
        }),
      }
    );
    const cart = await cRes.json();
    if (!cRes.ok) return json(cart, cRes.status);

    const checkoutUrl = cart?.data?.redirect_urls?.checkout_url;
    if (!checkoutUrl) return json({ error: 'No checkout_url returned' }, 502);

    // 5) Redirect to checkout at get.drinkpulsar.com
    return { statusCode: 302, headers: { Location: checkoutUrl }, body: '' };
  } catch (e) {
    return json({ error: 'Server error', detail: String(e?.message || e) }, 500);
  }
};

// ---- Helpers ----

// Auto-pick required modifier values (default or first) for multi-choice types.
// Throws if a required modifier is a typed field (text/number/date/file) that can't be auto-filled.
async function getRequiredModifierSelections(productId, skuForError) {
  const res = await fetch(
    `${API_BASE}/catalog/products/${productId}/modifiers?include_fields=id,display_name,type,required,is_required,option_values`,
    { headers: { 'X-Auth-Token': ADMIN_TOKEN, 'Accept': 'application/json' } }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Modifiers lookup failed (${res.status}): ${t}`);
  }
  const { data = [] } = await res.json();

  const requiredMods = data.filter(m => m?.required === true || m?.is_required === true);
  const selections = [];

  for (const mod of requiredMods) {
    // Multi-choice modifiers expose option_values; pick default or first.
    if (Array.isArray(mod.option_values) && mod.option_values.length > 0) {
      const picked = mod.option_values.find(v => v.is_default) || mod.option_values[0];
      selections.push({ option_id: mod.id, option_value: picked.id });
      continue;
    }

    // If it's a required typed modifier (text/number/date/file), we can't guess safely.
    // Make it optional in BC, add a default, or set MODS_BY_SKU with a concrete value via app logic.
    throw new Error(
      `Required modifier "${mod.display_name}" on SKU ${skuForError} needs a typed value (not auto-selectable).`
    );
  }

  return selections;
}

function json(body, statusCode = 200) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
