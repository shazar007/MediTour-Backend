const crypto = require("crypto");
const axios = require("axios");
const qs = require("qs");

const userLabController = {
  async handShakeCall(req, res, next) {
    console.log("challaaaa");
    try {
      var bankorderId = Math.floor(Math.random() * 1786613);
      // console.log(bankorderId);

      const Key1 = "AX2XK5EDSzeH3GUp"; // Ensure this is 16 bytes
      const Key2 = "4324907161932282"; // Ensure this is 16 bytes (used as IV in this case)
      const HS_ChannelId = "1001";
      const HS_MerchantId = "25317";
      const HS_StoreId = "034757";
      const HS_IsRedirectionRequest = 0;
      const HS_ReturnURL = "https://meditour.global/";
      const HS_MerchantHash = "OUU362MB1urdJj0FlIU2dhXFykjd0e7wU3jwlfFqV14=";
      const HS_MerchantUsername = "odywip";
      const HS_MerchantPassword = "yn9MpL1UQFNvFzk4yqF7CA==";
      const HS_TransactionReferenceNumber = bankorderId;
      const TransactionTypeId = 2;
      const Currency = "PKR";
      const IsBIN = 0;

      const cipher = "aes-128-cbc";

      const mapString =
        `HS_ChannelId=${HS_ChannelId}` +
        `&HS_IsRedirectionRequest=${HS_IsRedirectionRequest}` +
        `&HS_MerchantId=${HS_MerchantId}` +
        `&HS_StoreId=${HS_StoreId}` +
        `&HS_ReturnURL=${HS_ReturnURL}` +
        `&HS_MerchantHash=${HS_MerchantHash}` +
        `&HS_MerchantUsername=${HS_MerchantUsername}` +
        `&HS_MerchantPassword=${HS_MerchantPassword}` +
        `&HS_TransactionReferenceNumber=${HS_TransactionReferenceNumber}`;

      const cipheriv = crypto.createCipheriv(cipher, Key1, Key2);
      let cipherText = cipheriv.update(mapString, "utf8", "base64");
      cipherText += cipheriv.final("base64");

      console.log(cipherText);

      // Set headers for x-www-form-urlencoded
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };

      // Data to be sent in the body
      const data = qs.stringify({
        HS_MerchantId: HS_MerchantId,
        HS_StoreId: HS_StoreId,
        HS_ChannelId: HS_ChannelId,
        HS_MerchantHash: HS_MerchantHash,
        HS_MerchantUsername: HS_MerchantUsername,
        HS_MerchantPassword: HS_MerchantPassword,
        HS_IsRedirectionRequest: HS_IsRedirectionRequest,
        HS_ReturnURL: HS_ReturnURL,
        HS_RequestHash: cipherText,
        HS_TransactionReferenceNumber: HS_TransactionReferenceNumber,
      });

      // POST request
      let response = await axios.post(
        "https://sandbox.bankalfalah.com/HS/HS/HS",
        data,
        { headers }
      );
      let RequestHash1 = null;
      let transactionAmount = req.body.transactionAmount;

      if (response) {
        const mapStringSSO =
          `AuthToken=${response?.data?.AuthToken}` +
          `&RequestHash=${RequestHash1}` +
          `&ChannelId=${HS_ChannelId}` +
          `&Currency=${Currency}` +
          `&IsBIN=${IsBIN}` +
          `&ReturnURL=${HS_ReturnURL}` +
          `&MerchantId=${HS_MerchantId}` +
          `&StoreId=${HS_StoreId}` +
          `&MerchantHash=${HS_MerchantHash}` +
          `&MerchantUsername=${HS_MerchantUsername}` +
          `&MerchantPassword=${HS_MerchantPassword}` +
          `&TransactionTypeId=${TransactionTypeId}` +
          `&TransactionReferenceNumber=${HS_TransactionReferenceNumber}` +
          `&TransactionAmount=${transactionAmount}`;

        const cipheriv = crypto.createCipheriv(cipher, Key1, Key2);
        let cipherText1 = cipheriv.update(mapStringSSO, "utf8", "base64");
        cipherText1 += cipheriv.final("base64");

        return res.status(200).json({
          response: response.data,
          nextHash: cipherText1,
          t_referenceNumber: bankorderId,
          TransactionTypeId: TransactionTypeId,
          ChannelId: HS_ChannelId,
          MerchantId: HS_MerchantId,
          StoreId: HS_StoreId,
          MerchantHash: HS_MerchantHash,
          MerchantUsername: HS_MerchantUsername,
          MerchantPassword: HS_MerchantPassword,
          Currency: Currency,
          IsBIN: IsBIN,
          amount: transactionAmount,
          auth: true,
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
module.exports = userLabController;
