const redisClient = require("../config/redis");

// Get data from Redis cache
exports.getFromCache = async (key) => {
  try {
    const cachedData = await redisClient.get(key);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (err) {
    console.error("Redis GET Error:", err.message);
    return null;
  }
};

// Set data in Redis cache
exports.setInCache = async (key, ttl = 600, data) => {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error("Redis SET Error:", err.message);
  }
};

// Delete data from Redis cache
exports.deleteFromCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error("Redis DELETE Error:", err.message);
  }
};