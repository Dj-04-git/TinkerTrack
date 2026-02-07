const sequelize = require("../config/database");

const ProductPlan = sequelize.define("ProductPlan", {}, { timestamps: false });

module.exports = ProductPlan;
