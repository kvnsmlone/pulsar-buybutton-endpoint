exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};

    const email = params.email || "";
    const amount = params.amount || "";
    const orderId = params.orderId || "";
    const code = params.code || "";

    const url = `https://api.leaddyno.com/v1/purchases?key=ef0c0534045d3561102d7abcfc1ea64413e8f8a7`
      + `&customer_email=${encodeURIComponent(email)}`
      + `&purchase_amount=${encodeURIComponent(amount)}`
      + `&purchase_code=${encodeURIComponent(orderId)}`
      + `&code=${encodeURIComponent(code)}`;

    console.log("Calling LeadDyno:", url);

    const response = await fetch(url);
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
