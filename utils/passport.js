const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User/user"); // Adjust the path
const JWTService = require("../services/JWTService");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Helper function to generate the next MR number
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextMrNo() {
  // Find the latest user in the database and get their mrNo
  const latestUser = await User.findOne()
    .sort({ createdAt: -1 })
    .select("mrNo");

  // If there are no users yet, start with "000001"
  const nextMrNo = latestUser
    ? String(Number(latestUser.mrNo) + 1).padStart(6, "0")
    : "000001";

  return nextMrNo;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.HEROKU_URL}/auth/google/callback`, // Corrected callback URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile:", profile);

        // Check if a user with the Google ID already exists
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          console.log("No user found with Google ID. Checking by email...");

          // Check if a user with the same email exists (conventional signup)
          const emailRegex = new RegExp(profile.emails[0].value, "i");
          user = await User.findOne({ email: { $regex: emailRegex } });

          if (user) {
            console.log("User found with the same email. Linking Google account...");

            // Link Google account to the existing user
            user.googleId = profile.id;
            user.auth_provider = "google";
            user.oauth_id = profile.id;
            console.log("user in update")
            await user.save();
          } else {
            console.log("No user found with the same email. Creating a new user...");

            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              userImage: profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
              auth_provider: "google",
              oauth_id: profile.id,
              mrNo: await getNextMrNo(),
            });
          }
        }
        console.log("out here")

        // Generate tokens
        const accessToken = JWTService.signAccessToken({ _id: user._id }, "365d");
        const refreshToken = JWTService.signRefreshToken({ _id: user._id }, "365d");

        console.log("in here")
        
        // Store tokens in the database
        await JWTService.storeRefreshToken(refreshToken, user._id);
        await JWTService.storeAccessToken(accessToken, user._id);
        console.log("against here")
        
        // Attach tokens and user to the request
        user.token = { accessToken };
        console.log("against here again")
        return done(null, user);
      } catch (err) {
        console.error("Error in GoogleStrategy callback:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => User.findById(id, done));