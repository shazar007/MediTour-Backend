class docCompanyDto {
  constructor(doc) {
    this._id = doc._id;
    this.vendorId = doc.vendorId;
    this.doctorIds = doc.doctorIds;
    this.email = doc.email;
    this.phoneNumber = doc.phoneNumber;
    this.password = doc.password;
    this.name = doc.name;
    this.bankName = doc.bankName;
    this.accountHolderName = doc.accountHolderName;
    this.accountTitle = doc.accountTitle;
    this.ntn = doc.ntn;
    this.accountNumber = doc.accountNumber;
    this.blocked = doc.blocked;
    this.paidActivation = doc.paidActivation;
    this.activationRequest = doc.activationRequest;
    this.fcmToken = doc.fcmToken;
    this.doctorsAllowed = doc.doctorsAllowed;
    this.isNational = doc.isNational;
  }
}
module.exports = docCompanyDto;
