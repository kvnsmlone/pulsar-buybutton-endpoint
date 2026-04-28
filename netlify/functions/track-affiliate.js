exports.handler = async (event) => {
  console.log("🔥 WEBHOOK HIT");
  console.log("BODY:", event.body);

  return {
    statusCode: 200,
    body: "OK"
  };
};
