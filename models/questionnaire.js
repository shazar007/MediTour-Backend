const mongoose = require("mongoose");

const questionnaireSchema = new mongoose.Schema(

    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        contactNumber: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        department: {
            type: String,
            required: true
        },
        currentYearOfStudy: {
            type: String,
            // enum: ["firstYear", "secondYear", "thirdYear", "fourthYear", "graduate", "other"],
            required: true
        },
        areaOfInterest: {
            type: String,
            // enum: ["healthCare", "buisness", "marketing", "it(informationTechnology)", "media", "socialWork", "other"],
            required: true
        },
        medicalTourismHeardBefore: {
            type: Boolean,
            required: true
        },
        medicalTourism: {
            type: String
        },
        knowsMediTourGlobal: {
            type: Boolean,
            required: true
        },
        opinionOnMedicalTourism: {
            type: String,
        },
        familyMedicalTravelExperience: {
            type: Boolean,
            required: true
        },
        exploreInternationalHospitals: {
            type: Boolean,
            required: true
        },
        onlineMedicalServices: {
            type: Boolean,
            required: true
        },
        medicalTourismBenefit: {
            type: Boolean,
            required: true
        },
        awarenessCampaignInterest: {
            type: Boolean,
            required: true
        },
        internshipJobOpportunities: {
            type: Boolean,
            required: true
        },
        areaOfWorkingWithMediTour: {
            type: String,
            // enum: ["marketingAndSocialMedia", "buisnessDevelopmentAndSales", "healthCareAndPatientSupport", "itAndAppDevelopment", "graphicDesignAndContentCreation", "socialWork", "other(pleaseSpecify)"],
        },
        otherInterestedArea:{
            type:String,

        },
        careerUpdatesSubscription: {
            type: Boolean,
            required: true
        },
        skillsContribution: {
            type: Boolean,
            required: true
        },
        volunteerForCampaign: {
            type: Boolean,
            required: true
        },
        improvementsSuggestions: {
            type: String,
        },
        stayConnected: {
            type: Boolean,
            required: true
        },
        contactMethod: {
            type: [String], // Array of strings (e.g., ["Email", "WhatsApp"])
            // enum: ["email", "call", "whatsApp", "socialMedia"],
            required: true
        },
        additionalComments: {
            type: String
        },
        cvUploadUrl: {
            type: String, // URL of uploaded CV

        }
    },
    {
        timestamps: true // Adds createdAt and updatedAt fields
    }
);
module.exports = mongoose.model("Questionnaire", questionnaireSchema, "questionnaire");
