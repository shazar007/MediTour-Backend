const criteria = require("../../models/Donation/criteria.js");
const Donation = require("../../models/Donation/donationCompany.js");
const Package = require("../../models/Donation/package.js");
const DonorList = require("../../models/Donation/donations.js");
const User = require("../../models/User/user.js");
const Packages = require("../../models/Donation/package.js");
const _package = require("../../models/Donation/package.js");
const { sendchatNotification } = require("../../firebase/service");
const Notification = require("../../models/notification");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Admin = require("../../models/Admin/Admin");
async function generateMRNo() {
  try {
    // Find the latest donor in the database and get their mrNo
    const latestDonor = await DonorList.findOne({}, "donationId").sort({
      donationId: -1,
    });
    // If there are no donors yet, start with "000001"
    const nextMrNo = latestDonor
      ? String(Number(latestDonor.donationId) + 1).padStart(6, "0")
      : "000001";

    return nextMrNo;
  } catch (error) {
    throw error;
  }
}

const donationController = {
  async getRegisteredCompanies(req, res, next) {
    try {
      // Extract pagination parameters from the query string
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 30; // Default to 10 companies per page

      // Count the total number of companies
      const totalCompanies = await Donation.countDocuments({
        isVerified: true,
        paidActivation: true,
        blocked: false,
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalCompanies / limit);

      // Calculate the number of companies to skip based on the current page
      const skip = (page - 1) * limit;

      // Retrieve companies from the database with pagination, sorted by registration date
      const companies = await Donation.find({
        isVerified: true,
        paidActivation: true,
        blocked: false,
      })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);

      const companiesWithDonorCount = [];

      // Process each company to add donor count and populated donor details
      for (const company of companies) {
        // Aggregation pipeline to count distinct user IDs
        const result = await DonorList.aggregate([
          { $match: { companyId: company._id } }, // Filter by company ID
          { $group: { _id: "$userId" } }, // Group by user ID
          { $count: "userCount" }, // Count the distinct user IDs
        ]);

        // Extracting the user count from the result (if any)
        const userCount = result.length > 0 ? result[0].userCount : 0;

        // Populate user details including user image
        const populatedDonors = await DonorList.find({ companyId: company._id })
          .populate({
            path: "userId",
            select: "userImage", // Select fields to populate
            model: "Users",
          })
          .populate({
            path: "packageId",
            select: "images", // Select fields to populate
            model: "Packages",
          });

        // Add the company details with userCount and populated donors to the result array
        companiesWithDonorCount.push({
          company,
          userCount,
          donors: populatedDonors,
        });
      }

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated list of companies with pagination metadata
      return res.status(200).json({
        companies: companiesWithDonorCount,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalCompanies,
      });
    } catch (error) {
      // Handle errors
      return next(error);
    }
  },

  async getNgoCompany(req, res, next) {
    try {
      const companyId = req.query.companyId;

      // Find the company based on its ID
      const company = await Donation.findById(companyId);
      if (!company) {
        return res.status(404).json([]); // Send empty response
      }
      const packages = await Package.find({ donationId: companyId });

      // Extract images from packages
      const packageImages = packages
        .map((pkg) => ({ id: pkg._id, images: pkg.images }))
        .flat();

      // Combine company data with package images
      const companyWithPackageImages = {
        company,
        packageImages: packageImages,
      };

      return res.status(200).json(companyWithPackageImages);
    } catch (error) {
      return next(error);
    }
  },

  async getAllCriterion(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const limit = parseInt(req.query.limit) || 10; // Default to 10 criteria per page
      const activeDonations = await Donation.find({ paidActivation: true }).select("_id");

      // Get the total number of distinct criteria names
      const allCriteriaNames = await criteria.distinct("criteriaName");
     // Filter out criteria names that don't have any active donations
    const validCriteriaNames = [];
    for (const criteriaName of allCriteriaNames) {
      const hasActiveDonations = await criteria.exists({
        criteriaName,
        donationId: { $in: activeDonations.map(donation => donation._id) }
      });
      if (hasActiveDonations) {
        validCriteriaNames.push(criteriaName);
      }
    }

    const totalCriteria = validCriteriaNames.length; // Use the filtered valid criteria names
      // Calculate the total number of pages
      const totalPages = Math.ceil(totalCriteria / limit);

      // Calculate the number of criteria to skip based on the current page
      const skip = (page - 1) * limit;

      // Get the criteria names for the current page
      const paginatedCriteriaNames = allCriteriaNames.slice(skip, skip + limit);
     

      // Create an array to store criteria details for each paginated criteria name
      const criteriaWithDetails = [];
     

      // Fetch criteria details for each paginated criteria name
      for (const criteriaName of paginatedCriteriaNames) {
        const criteriaDetails = await criteria.find({ criteriaName, donationId: { $in: activeDonations.map(donation => donation._id) }}).populate({ path: "donationId",
          select: "paidActivation", }); // Select only criteriaName and the paidActivation field of donationId;
       // Only push criteria to the result if there are matching details
       if (criteriaDetails.length > 0) {
        criteriaWithDetails.push({ criteriaName, criteriaDetails });
      }
    }

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Send response with paginated criteria names and their details
      return res.status(200).json({
        criteria: criteriaWithDetails,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalCriteria,
      });
    } catch (error) {
      return next(error);
    }
  },
  
  async getCategoryPackageDetails(req, res, next) {
    try {
      const criteriaName = req.query.criteriaName;
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const limit = parseInt(req.query.limit) || 30; // Default to 10 criteria per page

      // Retrieve criteria by criteriaName
      const fetchedCriteria = await criteria.findOne({ criteriaName });

      if (!fetchedCriteria) {
        return res.status(404).json([]); // Send empty response
      }
      // Calculate pagination details
      const skip = (page - 1) * limit;

      // Retrieve and filter packages with pagination
      const totalPackages = await Package.countDocuments({
        criteriaId: fetchedCriteria._id,
      }); // Count total packages for the criteria

      // Retrieve packages by criteriaId and populate only the criteriaName field
      const packages = await Package.find({ criteriaId: fetchedCriteria._id })
        .populate({
          path: "criteriaId",
          select: "criteriaName", // Select only the criteriaName field
          match: { _id: fetchedCriteria._id }, // Match the criteriaId
        })
        .populate({
          path: "donationId"
          // select: "blocked", // Include the blocked field
        })
        .skip(skip) // Skip packages for previous pages
        .limit(limit); // Limit results to the current page

      // Filter out packages where donationId.blocked is true
      const filteredPackages = packages.filter(
        (pkg) => pkg.donationId && pkg.donationId.paidActivation===true&& !pkg.donationId.blocked
      );
      // Calculate total pages
      const totalPages = Math.ceil(totalPackages / limit);
      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Send response with filtered packages
      return res.status(200).json({
        packages: filteredPackages,
        previousPage,
        nextPage,
        totalPages,
        totalPackages,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getPackageDetails(req, res, next) {
    try {
      const packageId = req.query.packageId; // Assuming the package ID is provided as a route parameter

      // Retrieve the package by its ID and populate the companyId field with the associated company details
      const package = await Package.findById(packageId).populate("donationId");

      if (!package) {
        return res.status(404).json([]); // Send empty response
      }

      // Send response with the package details
      return res.status(200).json({ package });
    } catch (error) {
      return next(error);
    }
  },

  async addDonation(req, res, next) {
    try {
      const packageId = req.query.packageId;
      const companyId = req.query.companyId;
      const {
        paymentId,
        paidByUserAmount,
        donationAmount,
        processingFee,
        gatewayName,
      } = req.body;

      // Ensure that 'user' is correctly defined and attached to the request object
      const userId = req.user._id; // Assuming 'user' is attached to req object

      const donationId = await generateMRNo();

      // Fetch the package details to get the donationTitle
      const packageDetails = await _package.findById(packageId);
      const donationCompany = await Donation.findById(companyId);

      if (!packageDetails) {
        return res.status(404).json([]); // Send empty response
      }

      // Assuming 'user' has a 'name' property
      const donorName = req.user.name;

      // const donorImage= req.user.image// Accessing 'name' property from 'user'
      const isPaidFull = true;
      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      const newDonorList = new DonorList({
        paymentId: paymentIdArray,
        paidByUserAmount,
        donationId,
        companyId,
        packageId,
        userId,
        donorName,
        donationPurpose: packageDetails.donationTitle, // Use donationTitle from packageSchema
        isPaidFull,
        donationAmount,
        gatewayName,
        processingFee,
      });
      const savedDonorList = await newDonorList.save();
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: savedDonorList._id,
          idModelType: "Donations",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });
        stripeController = await stripePaymentToRegister.save();

        if (savedDonorList) {
          // Determine vendorId based on your application logic
          const vendorId = packageDetails.donationId; // Adjust this logic based on how vendorId is determined

          // Send chat notification to vendor
          sendchatNotification(
            vendorId,
            {
              title: "MediTour Global",
              message: `You have a new donation from ${donorName} for ${donationCompany.name}.`,
            },
            "Donation"
          );

          // Create and save a notification
          const notification = new Notification({
            senderId: userId,
            senderModelType: "Users",
            receiverId: vendorId,
            receiverModelType: "Donation Company",
            title: "MediTour Global",
            message: ` You have a new donation from ${donorName} for ${donationCompany.name}.`,
          });
          await notification.save();
          // Fetch all admins
          const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

          // Create notifications for each admin
          const adminNotifications = admins.map((admin) => ({
            senderId: userId,
            senderModelType: "Users",
            receiverId: admin._id,
            receiverModelType: "Admin",
            title: "MediTour Global",
            message: `Payment of ${paidByUserAmount} received from ${donorName} for ${donationCompany.name}.`,
          }));

          // Insert notifications into the database
          await Notification.insertMany(adminNotifications);

          // Send chat notifications to all admins asynchronously
          admins.forEach((admin) => {
            sendchatNotification(
              admin._id,
              {
                title: "MediTour Global",
                message: `Payment of ${paidByUserAmount} received from ${donorName} for ${donationCompany.name}.`,
              },
              "admin"
            );
          });

          // Respond with the saved donor list and success message
        }
      }
      res.status(201).json({
        donorList: savedDonorList,
        message: "Donation added successfully",
      });
    } catch (error) {
      // Return an error response
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  async getRecentDonors(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const donationsPerPage = 6;
      const totalDonations = await DonorList.countDocuments({}); // Get the total number of donations
      const totalPages = Math.ceil(totalDonations / donationsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * donationsPerPage; // Calculate the number of donations to skip based on the current page

      const donations = await DonorList.find({})
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order (recent first)
        .populate("userId") // Populate user details
        .skip(skip)
        .limit(donationsPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        donations: donations,
        auth: true,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getDonorProgresses(req, res, next) {
    try {
      // Fetch all packages
      const packages = await Package.find();

      // Array to store progress for each package
      const allProgresses = [];

      // Loop through each package
      for (const packageInfo of packages) {
        const packageId = packageInfo._id;

        // Find donations associated with the package and populate the package information
        const donations = await DonorList.find({ packageId: packageId })
          .populate("userId")
          .populate("packageId");

        // Aggregation pipeline to count distinct user IDs
        const result = await DonorList.aggregate([
          { $match: { packageId: packageId } }, // Filter by package ID
          { $group: { _id: "$userId" } }, // Group by user ID
          { $count: "userCount" }, // Count the distinct user IDs
        ]);

        // Extracting the user count from the result (if any)
        const userCount = result.length > 0 ? result[0].userCount : 0;

        // Calculate total donated amount for the package
        let totalDonationAmount = 0;
        donations.forEach((donation) => {
          totalDonationAmount += donation.donationAmount;
        });

        // Fetch donation purposes
        const donationPurposes = donations.map(
          (donation) => donation.donationPurpose
        );

        // Calculate progress percentage
        const progressPercentage =
          (totalDonationAmount / packageInfo.requiredAmount) * 100;

        // Calculate remaining amount
        const remainingAmount =
          packageInfo.requiredAmount - totalDonationAmount;

        // Store progress for the package
        allProgresses.push({
          packageId: packageId,
          progressPercentage: progressPercentage,
          remainingAmount: remainingAmount,
          userCount: userCount,
          donationPurposes: donationPurposes,
          donors: donations.map((donation) => ({
            userId: donation.userId._id,
            userImage: donation.userId.userImage,
          })),
          packageInfo: {
            // Accessing populated package information
            donationTitle: packageInfo.donationTitle,
            images: packageInfo.images,
          },
        });
      }

      // Send response with all donor progresses
      res.status(200).json(allProgresses);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
  async addRemoveFavPackages(req, res, next) {
    try {
      const packageId = req.query.packageId;
      const userId = req.user._id;

      const package = await Package.findById(packageId);
      if (!package) {
        return res.status(404).json([]); // Send empty response
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }

      const alreadyExistsIndex = user.favouritePackages.indexOf(packageId);

      if (alreadyExistsIndex !== -1) {
        // If PharmacyID is found in the favourites array, remove it using the pull operator
        user.favouritePackages.pull(packageId);
      } else {
        // If labId is not found, add it to the favourites array
        user.favouritePackages.push(packageId);
      }

      // Save the updated user document
      await user.save();

      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  },
  async getAllFavPackages(req, res, next) {
    try {
      const userId = req.user._id;

      const user = await User.findOne({ _id: userId }).populate(
        "favouritePackages"
      );
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }
      const favourites = user.favouritePackages;
      // Save the updated user document
      await user.save();

      return res.status(200).json({ favouritePackages: favourites });
    } catch (error) {
      return next(error);
    }
  },
};
module.exports = donationController;
