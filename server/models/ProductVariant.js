const { DataTypes } = require("sequelize");
const sequelize = require("../../db/db");

const ProductVariant = sequelize.define("ProductVariant", {
  attribute: {
    type: DataTypes.STRING,
    allowNull: false
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false
  },
  extraPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
});

module.exports = ProductVariant;
