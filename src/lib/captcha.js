async function verifyCaptcha(gRecaptcha) {
  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: "6Ld5uAAtAAAAABLoDNbHg6oBEcyNcf3_bC6xbBXJ",
          response: gRecaptcha,
        }),
      },
    );
    const data = await response.json();
    return data.success;
  } catch (error) {
    return false;
  }
}

module.exports = { verifyCaptcha };
