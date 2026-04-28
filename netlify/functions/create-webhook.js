exports.handler = async () => {
  const response = await fetch("https://api.bigcommerce.com/stores/rctyyem8fp/v3/hooks", {
    method: "POST",
    headers: {
      "X-Auth-Token": process.env.BC_ADMIN_TOKEN,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      scope: "store/order/created",
      destination: "https://subtle-taiyaki-7e739e.netlify.app/.netlify/functions/track-affiliate",
      is_active: true
    })
  });

  const data = await response.text();

  return {
    statusCode: 200,
    body: data
  };
};
