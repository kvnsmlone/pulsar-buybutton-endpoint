exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};

    const email = params.email || "";
    const amount = params.amount || "";
    const orderId = params.orderId || "";
    const code = params.code || "";

    const url = `https://static.leaddyno.com/track-purchase`
      + `?key=ef0c0534045d3561102d7abcfc1ea64413e8f8a7`
      + `&email=${encodeURIComponent(email)}`
      + `&amount=${encodeURIComponent(amount)}`
      + `&code=${encodeURIComponent(code)}`
      + `&purchase_code=${encodeURIComponent(orderId)}`;

    console.log("Calling LeadDyno pixel:", url);

    await fetch(url);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
