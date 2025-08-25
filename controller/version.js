const Version = require("../models/version");

const authController = {
  async updateVersion(req, res, next) {
    try {
      const version = req.body.version;
      const versionDoc = await Version.find();
      versionDoc[0].version = version;
      await versionDoc[0].save();
      return res.status(200).json({ version: versionDoc, auth: true });
    } catch (error) {
      return next(error);
    }
  },

  async getVersion(req, res, next) {
    try {
      const version = await Version.find();
      return res.status(200).json({ version, auth: true });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = authController;
