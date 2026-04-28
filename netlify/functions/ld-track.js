exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const res = await fetch("https://api.leaddyno.com/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: "ef0c0534045d3561102d7abcfc1ea64413e8f8a7",
        email: body.email,
        amount: body.amount,
        purchase_code: body.orderId,
        code: body.affiliate
      })
    });

    const data = await res.text();

    return {
      statusCode: 200,
      body: data
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: "Error"
    };
  }
};
