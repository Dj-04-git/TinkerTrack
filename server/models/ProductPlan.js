const sequelize = require("../../db/db");

const ProductPlan = sequelize.define("ProductPlan", {}, { timestamps: false });

module.exports = ProductPlan;
