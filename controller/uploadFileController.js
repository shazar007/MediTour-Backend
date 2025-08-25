const express = require("express");
const app = express();

const multer = require("multer");
const fs = require("fs");
const admin = require("firebase-admin");

const { firebase } = require("../firebase/");

const bucket = firebase.storage().bucket();

const uploadFileController = {
  async uploadFile(req, res) {
    try {
      if (req.file) {
        const file = fs.readFileSync(req.file.path);
        const imageRef = bucket.file(
          `profile_pictures/${req.file.originalname}`
        );

        bucket
          .upload(req.file.path, {
            destination: imageRef,
            metadata: {
              contentType: req.file.mimetype,
            },
          })
          .then(() => {
            // Delete the local file after uploading
            fs.unlinkSync(req.file.path);

            // Get the public URL of the uploaded image
            imageRef
              .getSignedUrl({
                action: "read",
                expires: "01-01-3000", // Set an expiration date if needed
              })
              .then((signedUrls) => {
                const imageUrl = signedUrls[0];
                return res.status(200).json({
                  fileUrl: imageUrl,
                });
                // })
              })
              .catch((error) => {
                return res.status(500).send("Error getting signed URL.");
              });
          })
          .catch((error) => {
            return res.status(500).send("Error uploading image.");
          });
      } else {
        return res.status(400).json({
          status: false,
          message: "Please select an image",
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async uploadMultipleFiles(req,res){
    try {
      if (req.files && req.files.length > 0) {
        const fileUrls = [];
  
        for (const file of req.files) {
          const fileContent = fs.readFileSync(file.path);
          const imageRef = bucket.file(`profile_pictures/${file.originalname}`);
  
          await bucket.upload(file.path, {
            destination: imageRef,
            metadata: {
              contentType: file.mimetype,
            },
            public: true, // Make the file publicly accessible
          });
  
          fs.unlinkSync(file.path);
  
          // Get the public URL directly from the image reference
          const publicUrl = await imageRef.publicUrl();
          fileUrls.push(publicUrl);
        }
  
        return res.status(200).json({
          fileUrls: fileUrls,
        });
      } else {
        return res.status(400).json({
          status: false,
          message: "Please select at least one image",
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  }
}
module.exports = uploadFileController;
