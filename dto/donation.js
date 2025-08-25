class donationDTO {
    constructor(donation) {
      this._id = donation._id;
      this.vendorId = donation.vendorId;
      this.email = donation.email;
      this.phoneNumber = donation.phoneNumber;
      this.password = donation.password;
      this.blocked = donation.blocked;
      this.name = donation.name;
      this.companyLicenseNo = donation.companyLicenseNo;
      this.companyLicenseExpiry = donation.companyLicenseExpiry;
      this.country=donation.country;
      this.ownerFirstName = donation.ownerFirstName;
      this.ownerLastName = donation.ownerLastName;
      this.companyEmergencyNo = donation.companyEmergencyNo;
      this.cnicOrPassportNo = donation.cnicOrPassportNo;
      this.cnicOrPassportExpiry = donation.cnicOrPassportExpiry;
      this.location = donation.location;
      this.description=donation.description;
      this.website = donation.website;
      this.ntn=donation.ntn;
      this.accountTitle=donation.accountTitle
      this.twitter = donation.twitter;
      this.youtube = donation.youtube;
      this.facebook = donation.facebook;
      this.instagram = donation.instagram;
      this.linkedIn = donation.linkedIn;
    this.incomeTaxNo = donation.incomeTaxNo;
      this.salesTaxNo = donation.salesTaxNo;
      this.bankName = donation.bankName;
      this.accountHolderName = donation.accountHolderName;
      this.accountNumber = donation.accountNumber;
      this.logo = donation.logo;
      this.licenseImage = donation.licenseImage;
      this.cnicImage = donation.cnicImage;
      this.taxFileImage = donation.taxFileImage;
      this.paidActivation = donation.paidActivation;
      this.activationRequest = donation.activationRequest;
      this.fcmToken = donation.fcmToken;
      this.email = donation.email;
      this.phoneNumber = donation.phoneNumber;
      this.password = donation.password;
      this.facebook = donation.facebook;
    }
  }
  module.exports = donationDTO;
