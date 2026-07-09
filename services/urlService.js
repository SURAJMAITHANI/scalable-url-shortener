const Url = require("../models/Url");
const geoip = require("geoip-lite");
const Analytic = require("../models/Analytic");
const { generateAlias } = require("../utils/generateAlias");
const cacheService = require("../services/cacheService");

// Create a short URL
exports.createShortUrlService = async (
  longUrl,
  customAlias,
  topic,
  userId,
  startDate,
  endDate
) => {
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    throw new Error("Start date must be earlier than end date.");
  }

  let alias = customAlias || generateAlias();
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const existing = await Url.findOne({ customAlias: alias });

    if (!existing) break;

    if (customAlias) {
      throw new Error(`Custom alias '${customAlias}' already exists.`);
    }

    alias = generateAlias();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error("Failed to generate a unique short URL.");
  }

  const shortUrl = `${process.env.BASE_URL.replace(/\/$/, "")}/${alias}`;

  const newUrl = new Url({
    userId,
    longUrl,
    topic,
    customAlias: alias,
    shortUrl,
    startDate,
    endDate,
  });

  const data = await newUrl.save();

  if (data) {
    await cacheService.setInCache(
      "dataAdded",
      600,
      JSON.stringify(data)
    );
  }

  return data;
};

// Redirect to original URL
exports.redirectUrlService = async (alias, req) => {
  const ipAddress = req.ip || "103.165.115.111";
  const geo = geoip.lookup(ipAddress);

  const fullShortUrl = `${process.env.BASE_URL.replace(/\/$/, "")}/${alias}`;

const url = await Url.findOne({ shortUrl: fullShortUrl });

  if (!url) {
    throw new Error("URL not found");
  }

  const now = new Date();
  console.log("========== TIME DEBUG ==========");
console.log("Current Time :", now);
console.log("Start Time   :", url.startDate);
console.log("End Time     :", url.endDate);
console.log("================================");

  if (url.startDate && now < url.startDate) {
    return {
      status: "NOT_ACTIVE",
      message: `This link will become active on ${url.startDate.toLocaleString()}`,
    };
  }

  if (url.endDate && now > url.endDate) {
    return {
      status: "EXPIRED",
      message: "This link has expired.",
    };
  }

  const analyticsData = {
    urlId: url._id,
    ipAddress,
    userAgent: req.headers["user-agent"],
    osType: req.useragent?.os || "Unknown",
    deviceType: req.useragent?.isMobile ? "mobile" : "desktop",
    platform: req.useragent?.platform || "Unknown",
    browser: req.useragent?.browser || "Unknown",
    country: geo?.country || null,
    region: geo?.region || null,
    city: geo?.city || null,
  };

  await Analytic.create(analyticsData);

  url.clicks += 1;
  await url.save();

  await cacheService.deleteFromCache(`shortUrl:${alias}`);
  await cacheService.deleteFromCache("overallAnalytics");
  await cacheService.deleteFromCache(`urlAnalytics:${alias}`);
  await cacheService.deleteFromCache(`topicAnalytics:${url.topic}`);

  return url.longUrl;
};