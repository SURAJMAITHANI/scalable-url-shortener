const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

const getCallbackURL = () => {
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  const base =
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base.replace(/\/$/, "")}/auth/google/callback`;
};

const isGoogleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_SECRET);

if (isGoogleConfigured()) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_SECRET,
        callbackURL: getCallbackURL(),
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id }).select(
            "+deletedUser"
          );

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email: profile.emails[0].value,
              displayName: profile.displayName,
            });
          } else if (user.deletedUser) {
            user.deletedUser = false;
            user.email = profile.emails[0].value;
            user.displayName = profile.displayName;
            await user.save();
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn(
    "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_SECRET in .env"
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = { isGoogleConfigured, getCallbackURL };
