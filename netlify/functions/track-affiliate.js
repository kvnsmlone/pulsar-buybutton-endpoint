exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};

    const email = params.email || "";
    const amount = params.amount || "";
    const orderId = params.orderId || "";
    const code = params.code || "";

    const url = "https://api.leaddyno.com/v1/purchases";

    const body = {
      key: "ef0c0534045d3561102d7abcfc1ea64413e8f8a7",
      customer_email: email,
      purchase_amount: amount,
      purchase_code: orderId,
      code: code
    };

    console.log("Sending to LeadDyno:", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
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
