const Tests = require("../../models/Laboratory/tests.js");
const TestName = require("../../models/Laboratory/testName");
const Joi = require("joi");
const TestDTO = require("../../dto/test.js");
const testNamesDTO = require("../../dto/testNames.js");
const laboratory = require("../../models/Laboratory/laboratory.js");

const labTestController = {
  async addTestToLabs(req, res, next) {
    const { name, testNameId } = req.body;

    // Define the schema for validation
    const labTestSchema = Joi.object({
      testDescription: Joi.string().required(),
      specimen: Joi.string().required(),
      price: Joi.number().required(),
      priceForMeditour: Joi.number().required(),
      name: Joi.string().optional(), // name is optional, since we have testNameId as an alternative
      testNameId: Joi.string().optional(), // testNameId is optional, since we have name as an alternative
    });

    // Validate the request body
    const { error } = labTestSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { testDescription, specimen } = req.body;
    const labId = req.user._id;
    let { priceForMeditour, price } = req.body;
    price = parseInt(price, 10);
    priceForMeditour = parseInt(priceForMeditour, 10);

    if (priceForMeditour >= price) {
      const error = new Error("priceForMeditour must be less than price");
      error.status = 400;
      return next(error);
    }

    // Calculate userAmount
    const priceDifference = price - priceForMeditour;
    let amount = priceForMeditour + 0.7 * priceDifference;
    const userAmount = Math.round(amount);
    const discount = price - userAmount;

    try {
      let testName;

      // Search for TestName by name or testNameId
      if (name) {
        testName = await TestName.findOne({ name });
        if (!testName) {
          return res.status(404).json([]);
        }
      } else if (testNameId) {
        testName = await TestName.findById(testNameId);
        if (!testName) {
          return res.status(404).json([]);
        }
      } else {
        const error = new Error(
          "Either 'name' or 'testNameId' must be provided."
        );
        error.status = 400;
        return next(error);
      }

      // Check if a test with the same testNameId already exists for this lab
      const duplicateTest = await Tests.findOne({
        labId,
        testNameId: testName._id,
      });
      if (duplicateTest) {
        const error = new Error("A test with this name already exists.");
        error.status = 404;
        return next(error);
      }

      // Generate a random testCode
      let testCode = Math.floor(Math.random() * 1000000);

      // Create and save the new test
      const testToRegister = new Tests({
        labId,
        testCode,
        testNameId: testName._id, // Store the testNameId instead of testName
        testDescription,
        specimen,
        price,
        priceForMeditour,
        userAmount,
        discount,
      });

      const test = await testToRegister.save();

      // Push the test ID into the `tests` array of the Lab document
      await laboratory.findByIdAndUpdate(
        labId,
        { $push: { tests: test._id } },
        { new: true }
      );

      const populatedTest = await Tests.findById(test._id)
        .populate("testNameId") // Ensure testNameId is populated with testName details
        .exec();

      // Prepare the response DTO
      const testDto = new TestDTO(populatedTest);

      // Send the response
      return res.status(201).json({ test: testDto, auth: true });
    } catch (error) {
      return next(error);
    }
  },
  async addTest(req, res, next) {
    // Define the validation schema for the test name
    const labId = req.user._id;
    const testNameSchema = Joi.object({
      testName: Joi.string().required(),
      categoryName: Joi.string().required(),
    });

    // Validate the request body against the schema
    const { error } = testNameSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Extract the test name from the request body
    const { testName, categoryName } = req.body;

    try {
      // Check if a test with the same name already exists
      const existingTest = await TestName.findOne({
        name: { $regex: testName, $options: "i" },
      });
      // subCategory: { $regex: subCategory, $options: 'i' }
      if (existingTest) {
        return res.status(409).json({ message: "Test name already exists." });
      }

      // Create a new test entry
      const testToRegister = new TestName({
        name: testName,
        categoryName,
        labId,
      });

      // Save the new test to the database
      const savedTest = await testToRegister.save();

      // Transform the saved test into a DTO
      const testDTO = new testNamesDTO(savedTest);

      // Return the created test in the response
      return res.status(201).json({ test: testDTO, auth: true });
    } catch (error) {
      return res.status(500).json([]);
    }
  },
  async getAllTests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const testsPerPage = 10;
      // Extract search term from query parameters
      const { search = "" } = req.query;
      const totalTests = await TestName.countDocuments({});

      // Create a filter object for the search term
      const filter = search ? { name: new RegExp(search, "i") } : {};

      const totalPages = Math.ceil(totalTests / testsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * testsPerPage;
      // Sab test names ko database se retrieve karain
      // const sortOrder = sort === 'desc' ? -1 : 1;
      const tests = await TestName.find(filter).sort({ name: 1 });

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      res.status(200).json({
        message: "Tests retrieved successfully",
        data: tests,
        totalTests,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
      });
    } catch (error) {
      return res.status(500).json([]);
    }
  },
  async editTest(req, res, next) {
    // Define the schema for validation
    const labTestSchema = Joi.object({
      testDescription: Joi.string(),
      specimen: Joi.string(),
      price: Joi.number(),
      priceForMeditour: Joi.number(),
    });

    // Validate the request body
    const { error } = labTestSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { testDescription, specimen } = req.body;
    const labId = req.user._id;
    const testId = req.query.testId;
    let { priceForMeditour, price } = req.body;
    price = parseInt(price, 10);
    priceForMeditour = parseInt(priceForMeditour, 10);

    try {
      // Check if the test exists
      const existingTest = await Tests.findById(testId);
      if (!existingTest) {
        return res.status(404).json([]);
      }

      // Update only the provided fields
      if (testDescription) existingTest.testDescription = testDescription;
      if (specimen) existingTest.specimen = specimen;
      if (price) existingTest.price = price;
      if (priceForMeditour) existingTest.priceForMeditour = priceForMeditour;

      // Recalculate userAmount if either price or priceForMeditour is updated
      if (price || priceForMeditour) {
        const newPrice = price || existingTest.price;
        const newPriceForMeditour =
          priceForMeditour || existingTest.priceForMeditour;

        if (newPriceForMeditour >= newPrice) {
          const error = new Error("priceForMeditour must be less than price");
          error.status = 400;
          return next(error);
        }

        const priceDifference = newPrice - newPriceForMeditour;
        existingTest.userAmount = newPriceForMeditour + 0.7 * priceDifference;
        existingTest.userAmount = Math.round(existingTest.userAmount);
        existingTest.discount = price - existingTest.userAmount;
      }

      // Save the updated test
      await existingTest.save();

      return res
        .status(200)
        .json({ message: "Test updated successfully", test: existingTest });
    } catch (error) {
      return next(error);
    }
  },

  async deleteTest(req, res, next) {
    try {
      const testId = req.query.testId;

      // Find the test to delete
      const existingTest = await Tests.findById(testId);

      if (!existingTest) {
        return res.status(404).json([]);
      }

      // Get the laboratory id from the test (assuming the test schema has a reference to the lab)
      const labId = existingTest.labId; // Adjust this based on your schema

      // Delete the test document
      await Tests.deleteOne({ _id: testId });

      // Remove the test from the lab's test array
      await laboratory.updateOne({ _id: labId }, { $pull: { tests: testId } });

      return res.status(200).json({ message: "Test deleted successfully" });
    } catch (error) {
      next(error);
    }
  },

  async getTest(req, res, next) {
    try {
      const testId = req.query.testId;
      const test = await Tests.findById(testId).populate({
        path: "testNameId",
        select: "name categoryName", // Include name and categoryName in the population
      });

      if (!test) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ test });
    } catch (error) {
      return next(error);
    }
  },

  async getAllLabTest(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const testsPerPage = 10;
      const labId = req.user._id;

      const totalTests = await Tests.countDocuments({ labId }); // Get the total number of tests for the lab

      const totalPages = Math.ceil(totalTests / testsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * testsPerPage; // Calculate the number of tests to skip based on the current page

      const tests = await Tests.find({ labId })
        .populate({
          path: "testNameId",
          select: "name categoryName", // Include categoryName in the population
        })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .skip(skip)
        .limit(testsPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        tests: tests,
        auth: true,
        totalTests,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};
module.exports = labTestController;
