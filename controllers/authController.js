const passport = require("passport");

const User = require("../models/User");
const { generateJwtToken } = require("../utils/generateJwtToken");
const { isGoogleConfigured, getCallbackURL } = require("../config/passport");

const sendLoginSuccess = (req, res, user) => {
  const token = generateJwtToken(user);
  const acceptsJson = req.headers.accept?.includes("application/json");

  if (acceptsJson) {
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.displayName,
        email: user.email,
      },
    });
  }

  res.redirect(`/?token=${token}`);
};

//! Auth status for frontend
exports.authStatus = (req, res) => {
  const devLoginEnabled =
    process.env.NODE_ENV !== "production" || process.env.DEV_LOGIN === "true";

  res.json({
    googleConfigured: isGoogleConfigured(),
    devLoginEnabled,
    callbackURL: isGoogleConfigured() ? getCallbackURL() : null,
  });
};

//! Google OAuth login
exports.googleLogin = (req, res, next) => {
  if (!isGoogleConfigured()) {
    return res.redirect("/?error=google_not_configured");
  }

  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
};

//! Google OAuth callback
exports.googleCallback = (req, res, next) => {
  if (!isGoogleConfigured()) {
    return res.redirect("/?error=google_not_configured");
  }

  passport.authenticate(
    "google",
    { failureRedirect: "/?error=auth_failed" },
    (err, user) => {
      if (err) return next(err);
      if (!user) return res.redirect("/?error=auth_failed");

      sendLoginSuccess(req, res, user);
    }
  )(req, res, next);
};

//! Dev login (when Google OAuth is not set up)
exports.devLogin = async (req, res) => {
  const devLoginEnabled =
    process.env.NODE_ENV !== "production" || process.env.DEV_LOGIN === "true";

  if (!devLoginEnabled) {
    return res.status(403).json({
      success: false,
      message: "Dev login is disabled in production",
    });
  }

  try {
    const devGoogleId = "dev-local-user";
    let user = await User.findOne({ googleId: devGoogleId }).select(
      "+deletedUser"
    );

    if (!user) {
      user = await User.create({
        googleId: devGoogleId,
        email: "dev@localhost",
        displayName: "Dev User",
      });
    } else if (user.deletedUser) {
      user.deletedUser = false;
      user.displayName = "Dev User";
      await user.save();
    }

    sendLoginSuccess(req, res, user);
  } catch (err) {
    console.error("Dev login failed:", err);
    res.redirect("/?error=dev_login_failed");
  }
};

//! Logout
exports.googleLogout = (req, res) => {
  req.logout((err) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Logout failed", error: err });
    }
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  });
};

//! find me
exports.findMe = async (req, res) => {
  try {
    const googleId = req.user.googleId;
    const user = await User.findOne({ googleId }).select("+deletedUser");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.deletedUser) {
      return res.status(500).json({
        success: false,
        message: "User is deleted",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("something went wrong while fetching me: ", err.message);
    return res.status(401).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

//! delete My account

exports.deleteMyAccount = async (req, res) => {
  try {
    const googleId = req.user.googleId;
    const user = await User.findOne({ googleId }).select("+deletedUser");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.deletedUser) {
      return res.status(500).json({
        success: false,
        message: "User already deleted",
      });
    }
    const deletedUser = await User.findOneAndUpdate(
      { googleId, deletedUser: false },
      { deletedUser: true },
      { new: true } // Return the updated document
    );

    if (deletedUser) {
      return res.status(200).json({
        success: true,
        message: `${user.displayName} has been deleted`,
      });
    }
  } catch (err) {
    console.error(
      "something went wrong while deleting my account: ",
      err.message
    );

    return res.status(400).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

exports.login = (req, res) => {
  return res.send(`<a href="/auth/google">Google Login</a>`);
};
