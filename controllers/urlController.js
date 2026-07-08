// const useragent = require("useragent");
const urlService = require("../services/urlService");

exports.createShortUrl = async (req, res) => {
  try {
    const {
      longUrl,
      customAlias,
      topic,
      startDate,
      endDate,
    } = req.body;
    const userId = req.user.id;

    const newUrl = await urlService.createShortUrlService(
      longUrl,
      customAlias,
      topic,
      userId,
      startDate,
      endDate
);
    return res.status(201).json({
      success: true,
      newUrl,
    });
  } catch (err) {
    console.error("Error creating short URL:", err);

    if (err.code === 11000 && err.keyPattern?.shortUrl) {
      return res.status(409).json({
        success: false,
        message: "Generated short URL already exists. Please try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to shorten the URL",
      error: err.message,
    });
  }
};

exports.redirectUrl = async (req, res) => {
  try {
    const { alias } = req.params;

    const result = await urlService.redirectUrlService(alias, req);

if (typeof result === "object") {
  return res.status(200).json({
    success: false,
    status: result.status,
    message: result.message,
  });
}

return res.redirect(result);
  } catch (err) {
    console.error("Something went wrong while redirecting : ", err);
    return res.status(500).json({
      success: false,
      message: "Failed to redirect URL",
      error: err.message,
    });
  }
};
