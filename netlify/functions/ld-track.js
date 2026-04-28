exports.handler = async (event) => {

  // 🔹 Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: "Method Not Allowed"
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const { orderId, amount, email, affiliate } = body;

    if (!orderId || !amount || !email || !affiliate) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*"
        },
        body: "Missing required fields"
      };
    }

    console.log("Sending to LeadDyno:", { orderId, amount, email, affiliate });

    const response = await fetch("https://api.leaddyno.com/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: "ef0c0534045d3561102d7abcfc1ea64413e8f8a7",
        email,
        amount,
        purchase_code: orderId,
        code: affiliate
      })
    });

    const data = await response.text();

    console.log("LeadDyno response:", data);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: data
    };

  } catch (error) {
    console.error("Function error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: "Internal Server Error"
    };
  }
};
