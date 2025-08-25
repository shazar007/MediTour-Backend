class AdminDTO {
    constructor(admin) {
      this._id = admin._id;
      this.name = admin.name;
      this.email = admin.email;
      this.phone = admin.phone;
      this.password = admin.password;
      this.fcmToken = admin.fcmToken;
    }
  }
  
  module.exports = AdminDTO;
  