exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};

    const email = params.email || "";
    const amount = params.amount || "";
    const orderId = params.orderId || "";
    const code = params.code || "";

    const response = await fetch("https://api.leaddyno.com/v1/purchases", {
      method: "POST",
      headers: {
        "Authorization": "Bearer d040ace117263265e5054188122b7ae7b161259f",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer_email: email,
        purchase_amount: amount,
        purchase_code: orderId,
        code: code
      })
    });

    const result = await response.text();
    console.log("LeadDyno response:", result);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result })
    };

  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
