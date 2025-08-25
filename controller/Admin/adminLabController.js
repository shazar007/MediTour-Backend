const TestCategory = require("../../models/Laboratory/testCategory.js");
const Joi = require("joi");
const TestDTO = require("../../dto/test.js");
const JWTService = require("../../services/JWTService.js");
const Tests = require("../../models/Laboratory/tests.js");

const adminLabController = {
  async addTestCategory(req, res, next) {
    const testCategorySchema = Joi.object({
      categoryName: Joi.string().required(),
    });

    const { error } = testCategorySchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const { categoryName } = req.body;

    let testCategory;

    try {
      const testCategoryToRegister = new TestCategory({
        categoryName,
      });

      testCategory = await testCategoryToRegister.save();
    } catch (error) {
      return next(error);
    }

    return res.status(201).json({ testCategory: testCategory, auth: true });
  },

  async deleteTestCategory(req, res, next) {
    const testCategoryId = req.query.testCategoryId;
    const existingTestCategory = await TestCategory.findById(testCategoryId);

    if (!existingTestCategory) {
      return res.status(404).json([]);
    }
    await TestCategory.deleteOne({ _id: testCategoryId });
    return res
      .status(200)
      .json({ message: "Test Category deleted successfully" });
  },

  async getAllTestCategory(req, res, next) {
    try {
      // const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      // const testCategoryPerPage = 10;
      // const totalTests = await TestCategory.countDocuments({}); // Get the total number of posts for the user
      // const totalPages = Math.ceil(totalTests / testCategoryPerPage); // Calculate the total number of pages

      // const skip = (page - 1) * testCategoryPerPage; // Calculate the number of posts to skip based on the current page
      const testCategories = await TestCategory.find({});
      // .skip(skip)
      // .limit(testCategoryPerPage);
      // let previousPage = page > 1 ? page - 1 : null;
      // let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        testCategories: testCategories,
        auth: true,
        // previousPage: previousPage,
        // nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};
module.exports = adminLabController;
