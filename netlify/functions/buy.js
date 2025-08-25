// Public URL you'll use from Webflow:
//   https://<your-site>.netlify.app/buy?sku=PUL-30-SRV&qty=1

const STORE_HASH = 'rctyyem8fp';   // not secret
const CHANNEL_ID = 1778657;        // not secret

exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    const sku = p.sku;
    const qty = parseInt(p.qty || '1', 10) || 1;

    if (!sku) return json({ error: 'Missing sku' }, 400);

    const ADMIN_TOKEN = process.env.BC_ADMIN_TOKEN; // set in Netlify env vars
    if (!ADMIN_TOKEN) return json({ error: 'Server not configured: missing BC_ADMIN_TOKEN' }, 500);

    // 1) Variant lookup by SKU
    const vRes = await fetch(
      `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/catalog/variants?sku=${encodeURIComponent(sku)}&include_fields=id,product_id,sku`,
      { headers: { 'X-Auth-Token': ADMIN_TOKEN, 'Accept': 'application/json' } }
    );
    const vJson = await vRes.json();
    if (!vRes.ok || !vJson.data?.length) return json({ error: 'SKU not found or unavailable' }, 404);
    const { id: variant_id, product_id } = vJson.data[0];

    // 2) Create cart on headless channel; request redirect URLs
    const cRes = await fetch(
      `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/carts?include=redirect_urls`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Token': ADMIN_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          line_items: [{ quantity: qty, product_id, variant_id }],
          channel_id: CHANNEL_ID
        })
      }
    );
    const cart = await cRes.json();
    if (!cRes.ok) return json(cart, cRes.status);

    const checkoutUrl = cart?.data?.redirect_urls?.checkout_url;
    if (!checkoutUrl) return json({ error: 'No checkout_url returned' }, 502);

    // 3) Redirect to BC checkout (get.drinkpulsar.com)
    return { statusCode: 302, headers: { Location: checkoutUrl }, body: '' };
  } catch (e) {
    return json({ error: 'Server error', detail: String(e) }, 500);
  }
};

function json(body, statusCode = 200) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
