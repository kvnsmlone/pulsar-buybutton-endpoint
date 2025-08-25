// /netlify/functions/buy.js
// Public URL you'll use from Webflow:
//   https://<your-site>.netlify.app/buy?plan=single|1bag|2bag&qty=1
//   (or for testing) https://<your-site>.netlify.app/buy?sku=PUL-30-SRV&qty=1

// Hard-coded NON-SECRETS
const STORE_HASH = 'rctyyem8fp';
const CHANNEL_ID = 1778657;
const API_BASE = `https://api.bigcommerce.com/stores/${STORE_HASH}/v3`;

// SECRET (keep in Netlify env vars -> BC_ADMIN_TOKEN)
const ADMIN_TOKEN = process.env.BC_ADMIN_TOKEN;

// Plan → SKU map (long names + short slugs)
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

    // 2) Quantity rules
    const quantity = sku === 'PUL-30-SRV-2PAK'
      ? 1
      : Math.max(1, Number.isFinite(qtyParam) ? qtyParam : 1);

    // 3) Create cart on headless channel and request redirect URLs in one call
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
          line_items: [{ product_id, variant_id, quantity }],
        }),
      }
    );
    const cart = await cRes.json();
    if (!cRes.ok) return json(cart, cRes.status);

    const checkoutUrl = cart?.data?.redirect_urls?.checkout_url;
    if (!checkoutUrl) return json({ error: 'No checkout_url returned' }, 502);

    // 4) Redirect to checkout at get.drinkpulsar.com
    return { statusCode: 302, headers: { Location: checkoutUrl }, body: '' };
  } catch (e) {
    return json({ error: 'Server error', detail: String(e) }, 500);
  }
};

function json(body, statusCode = 200) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
