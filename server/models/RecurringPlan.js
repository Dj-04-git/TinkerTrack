const { DataTypes } = require("sequelize");
const sequelize = require("../../db/db");

const RecurringPlan = sequelize.define("RecurringPlan", {
  planName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  billingPeriod: {
    type: DataTypes.ENUM("DAILY", "WEEKLY", "MONTHLY", "YEARLY"),
    allowNull: false
  }
});

module.exports = RecurringPlan;
