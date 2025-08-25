const { firebase } = require("../");
const { chatTemplatePlaceholder } = require("../utils/metaDataReplacer");
const {
  chatnotificationsCategories,
  getFcmTokenForChat,
} = require("./chatNotificationCategories");

async function sendchatNotification(userId, messageData, type) {
  let userToken = await getFcmTokenForChat(userId, type);
  let message = {
    token: userToken,
    notification: {
      title: messageData.title ? messageData.title : "MediTour",
      body: messageData?.message,
    },
  };

  try {
    const response = await firebase.messaging().send(message);
    console.log("firebase notification sent successfully!", response);
  } catch (err) {
    console.log("error sending notification!", err);
  }
}

module.exports = { sendchatNotification };
