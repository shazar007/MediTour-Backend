class criteriaDTO {
    constructor(criteria) {
      this._id = criteria._id;
      this.criteriaName = criteria.criteriaName;
      this.description = criteria.description;
      this.image = criteria.image;
    }
  }
  module.exports = criteriaDTO;
