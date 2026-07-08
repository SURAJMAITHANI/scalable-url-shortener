const express = require("express");
const {
  authStatus,
  googleLogin,
  googleCallback,
  googleLogout,
  devLogin,
  findMe,
  deleteMyAccount,
} = require("../controllers/authController");
const protect = require("../middlewares/authMiddleware");
const authRouter = express.Router();

//! auth status
authRouter.get("/status", authStatus);

//! dev login (local testing without Google)
authRouter.get("/dev-login", devLogin);

//! google login
authRouter.get("/google", googleLogin);

//! google callback
authRouter.get("/google/callback", googleCallback);

//! google logout
authRouter.get("/logout", googleLogout);

//! find me
authRouter.get("/me", protect, findMe);

//! delete my account
authRouter.delete("/delete-account", protect, deleteMyAccount);

module.exports = authRouter;
