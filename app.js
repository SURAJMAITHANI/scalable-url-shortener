require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const passport = require("passport");
const useragent = require("express-useragent");

require("./config/passport");

const connectDB = require("./config/db");
const limiter = require("./middlewares/rateLimit");

const authRoutes = require("./routes/authRoutes");
const urlRoutes = require("./routes/urlRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const { redirectUrl } = require("./controllers/urlController");

const app = express();

app.set("trust proxy", true);

connectDB();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
    },
  })
);

app.use(useragent.express());

app.use(passport.initialize());
app.use(passport.session());

app.use("/api", limiter);

app.get("/api/test", (req, res) => {
  res.json({ message: "Rate limiter test successful" });
});

app.use("/auth", authRoutes);
app.use("/api/v1/shorten", urlRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// Redirect route (IMPORTANT)
app.get("/:alias", redirectUrl);

// Static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});