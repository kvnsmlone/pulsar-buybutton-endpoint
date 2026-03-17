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

// Optional modifier selections
const MODS_BY_SKU = {};

const norm = (s = '') => s.toLowerCase().trim();

exports.handler = async (event) => {
  try {

    if (!ADMIN_TOKEN) {
      return json({ error: 'Server not configured: missing BC_ADMIN_TOKEN' }, 500);
    }

    const qs = event.queryStringParameters || {};

    // -----------------------------
    // IMPORTANT FIX
    // -----------------------------
    // Default plan = SINGLE ORDER
    // -----------------------------

    const plan = norm(qs.plan || 'single');

    const qtyParam = parseInt(qs.qty || '1', 10);

    const skuParam = qs.sku;

    const sku =
      skuParam ||
      PLAN_TO_SKU[plan] ||
      'PUL-30-SRV';   // fallback safety


    // 1️⃣ Variant lookup by SKU
    const vRes = await fetch(
      `${API_BASE}/catalog/variants?sku=${encodeURIComponent(sku)}&include_fields=id,product_id,sku`,
      {
        headers: {
          'X-Auth-Token': ADMIN_TOKEN,
          'Accept': 'application/json'
        }
      }
    );

    const vJson = await vRes.json();

    if (!vRes.ok || !vJson.data?.length) {
      return json({ error: `SKU not found or unavailable: ${sku}` }, 404);
    }

    const { id: variant_id, product_id } = vJson.data[0];


    // 2️⃣ Build modifier selections
    let option_selections = MODS_BY_SKU[sku] || [];

    if (!option_selections.length) {
      option_selections = await getRequiredModifierSelections(product_id, sku);
    }


    // 3️⃣ Quantity rules
    const quantity =
      sku === 'PUL-30-SRV-2PAK'
        ? 2
        : Math.max(1, Number.isFinite(qtyParam) ? qtyParam : 1);


    // 4️⃣ Create cart
    const cRes = await fetch(
      `${API_BASE}/carts?include=redirect_urls`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Token': ADMIN_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          channel_id: CHANNEL_ID,
          line_items: [{
            product_id,
            variant_id,
            quantity,
            ...(option_selections.length ? { option_selections } : {})
          }]
        })
      }
    );

    const cart = await cRes.json();

    if (!cRes.ok) {
      return json(cart, cRes.status);
    }

    const checkoutUrl = cart?.data?.redirect_urls?.checkout_url;

    if (!checkoutUrl) {
      return json({ error: 'No checkout_url returned' }, 502);
    }

    // 5️⃣ Redirect to checkout
    return {
      statusCode: 302,
      headers: { Location: checkoutUrl },
      body: ''
    };

  } catch (e) {

    return json({
      error: 'Server error',
      detail: String(e?.message || e)
    }, 500);

  }
};


// ------------------------------------------------------
// Helpers
// ------------------------------------------------------

async function getRequiredModifierSelections(productId, skuForError) {

  const res = await fetch(
    `${API_BASE}/catalog/products/${productId}/modifiers?include_fields=id,display_name,type,required,is_required,option_values`,
    {
      headers: {
        'X-Auth-Token': ADMIN_TOKEN,
        'Accept': 'application/json'
      }
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Modifiers lookup failed (${res.status}): ${t}`);
  }

  const { data = [] } = await res.json();

  const requiredMods = data.filter(
    m => m?.required === true || m?.is_required === true
  );

  const selections = [];

  for (const mod of requiredMods) {

    if (Array.isArray(mod.option_values) && mod.option_values.length > 0) {

      const picked =
        mod.option_values.find(v => v.is_default) ||
        mod.option_values[0];

      selections.push({
        option_id: mod.id,
        option_value: picked.id
      });

      continue;
    }

    throw new Error(
      `Required modifier "${mod.display_name}" on SKU ${skuForError} needs a typed value`
    );
  }

  return selections;
}


function json(body, statusCode = 200) {

  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };

}
