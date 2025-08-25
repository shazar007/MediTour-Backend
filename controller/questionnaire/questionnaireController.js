const express = require("express");
const mongoose = require("mongoose");
const app = express();
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const Questionnaire = require("../../models/questionnaire");

const passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
    try {
        // Find the latest pharmacy order in the database and get its orderId
        const latestVendor = await DoctorCompany.findOne({}).sort({
            createdAt: -1,
        });

        let nextVendorId = 1;
        if (latestVendor && latestVendor.vendorId) {
            // Extract the numeric part of the orderId and increment it
            const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
            nextVendorId = currentVendorId + 1;
        }
        // Generate the next orderId
        const nextOrderId = `DCP${nextVendorId.toString().padStart(4, "0")}`;

        return nextOrderId;
    } catch (error) {
        throw new Error("Failed to generate order number");
    }
}

const questionnaireController = {
    async submitQuestionnaire(req, res, next) {
        try {
            // Joi Schema for Validation
            const questionnaireSchema = Joi.object({
                fullName: Joi.string().trim().required(),
                contactNumber: Joi.string().required(),
                email: Joi.string().email().required(),
                department: Joi.string().required(),
                currentYearOfStudy: Joi.string()
                    .required(),
                areaOfInterest: Joi.string()
                    .required(),
                medicalTourismHeardBefore: Joi.boolean().required(),
                medicalTourism: Joi.string().optional(),
                knowsMediTourGlobal: Joi.boolean().required(),
                opinionOnMedicalTourism: Joi.string().optional(),
                familyMedicalTravelExperience: Joi.boolean().required(),
                exploreInternationalHospitals: Joi.boolean().required(),
                onlineMedicalServices: Joi.boolean().required(),
                medicalTourismBenefit: Joi.boolean().required(),
                awarenessCampaignInterest: Joi.boolean().required(),
                internshipJobOpportunities: Joi.boolean().required(),
                areaOfWorkingWithMediTour: Joi.string(),
                otherInterestedArea: Joi.string(),
                careerUpdatesSubscription: Joi.boolean().required(),
                skillsContribution: Joi.boolean().required(),
                volunteerForCampaign: Joi.boolean().required(),
                improvementsSuggestions: Joi.string().optional(),
                stayConnected: Joi.boolean().required(),
                contactMethod: Joi.array()
                    .items(Joi.string()).required(),
                additionalComments: Joi.string().optional(),
                cvUploadUrl: Joi.string().uri().optional(), // Optional: CV can be uploaded later
            });

            // Validate the request body against the schema
            const { error } = questionnaireSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            // Extract fields from request body
            const questionnaireData = req.body;

            // Save questionnaire data in MongoDB
            const newQuestionnaire = new Questionnaire(questionnaireData);
            await newQuestionnaire.save();

            return res.status(201).json({
                message: "Questionnaire submitted successfully",
                questionnaire: newQuestionnaire,
            });
        } catch (err) {
            next(err); // Pass any errors to the error handler
        }
    },
    async getAllQuestionnaires(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1; // Get the page number from the query parameter
            const questionnairePerPage = 10;
            const totalQuestionnaires = await Questionnaire.countDocuments({});
            const totalPages = Math.ceil(totalQuestionnaires / questionnairePerPage);
            const skip = (page - 1) * questionnairePerPage;

            // Fetch the treatments with nested population
            const questionnaire = await Questionnaire.find({})
                .skip(skip)
                .limit(questionnairePerPage)
                .sort({ createdAt: -1 });

            let previousPage = page > 1 ? page - 1 : null;
            let nextPage = page < totalPages ? page + 1 : null;

            res.json({
                auth: true,
                questionnaire: questionnaire,
                totalQuestionnaires: totalQuestionnaires,
                previousPage: previousPage,
                nextPage: nextPage,
            });
        } catch (error) {
            next(error);
        }
    },
    async getQuestionnaire(req, res, next) {
        try {
            const { id } = req.query; // Get ID from request params

            // Find questionnaire by ID
            const questionnaire = await Questionnaire.findById(id);

            // If no questionnaire found, return error
            if (!questionnaire) {
                return res.status(404).json({
                    auth: false,
                    message: "Questionnaire not found",
                });
            }

            // Return the found questionnaire
            res.json({
                auth: true,
                questionnaire: questionnaire,
            });
        } catch (error) {
            next(error); // Pass any errors to the error handler
        }
    }

}
module.exports = questionnaireController;
