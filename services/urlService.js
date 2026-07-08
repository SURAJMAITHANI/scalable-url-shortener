const Url = require("../models/Url");
const geoip = require("geoip-lite");
const Analytic = require("../models/Analytic");
const { generateAlias } = require("../utils/generateAlias");
const redisClient = require("../config/redis");
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

  let shortUrl = customAlias || generateAlias();
  let attempts = 0;
  const maxAttempts = 3;

  let isAliasFind;

  do {
    isAliasFind = await Url.findOne({ shortUrl });

    if (isAliasFind) {
      if (customAlias) {
        throw new Error(`Custom alias '${customAlias}' already exists.`);
      } else {
        shortUrl = generateAlias();
      }
      attempts++;
    }
  } while (isAliasFind && attempts < maxAttempts && !customAlias);

  if (attempts >= maxAttempts && !customAlias) {
    throw new Error(
      "Failed to generate unique short URL after multiple attempts."
    );
  }

  const newUrl = new Url({
    userId,
    longUrl,
    topic,
    customAlias,
    shortUrl,
    startDate,
    endDate,
});

  const data = await newUrl.save();
  if (data) {
    await cacheService.setInCache("dataAdded", 600, JSON.stringify(data));
    return data;
  }
};

// Redirect to the original URL and log analytics
exports.redirectUrlService = async (alias, req) => {
  const ipAddress = req.ip || "103.165.115.111";
  const geo = geoip.lookup(ipAddress);

  const url = await Url.findOne({ shortUrl: alias });
  if (!url) {
    throw new Error("URL not found");
  }
  const now = new Date();
  if (url.startDate && now < url.startDate) {
    return {
      status: "NOT_ACTIVE",
      message: `This link will become active on ${url.startDate.toLocaleString()}`
    };
  }
  if (url.endDate && now > url.endDate) {
    return {
      status: "EXPIRED",
      message: "This link has expired."
    };
  }
  const analyticsData = {
    urlId: url._id,
    ipAddress,
    userAgent: req.headers["user-agent"],
    osType: req.useragent.os || "Unknown",
    deviceType: req.useragent.isMobile ? "mobile" : "desktop",
    platform: req.useragent.platform || "Unknown",
    browser: req.useragent.browser || "Unknown",
    country: geo?.country || null,
    region: geo?.region || null,
    city: geo?.city || null,
  };

  const newAnalytics = new Analytic(analyticsData);
  await newAnalytics.save();

  url.clicks += 1;
  await url.save();

  const key = `shortUrl:${req.originalUrl}`;
  await cacheService.deleteFromCache(key);
  //   redisClient.del(key);

  const userKey = `overallAnalytics`;
  await cacheService.deleteFromCache(userKey);

  const urlAnalyticsKey = `urlAnalytics:${alias}`;
  await cacheService.deleteFromCache(urlAnalyticsKey);

  const topicAnalyticsKey = `topicAnalytics:${url.topic}`;
  await cacheService.deleteFromCache(topicAnalyticsKey);

  return url.longUrl;
};
