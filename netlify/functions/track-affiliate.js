exports.handler = async (event) => {
  console.log("🔥 METHOD:", event.httpMethod);
  console.log("🔥 HEADERS:", event.headers);
  console.log("🔥 BODY:", event.body);

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true
    })
  };
};
