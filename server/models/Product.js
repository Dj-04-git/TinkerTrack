const { DataTypes } = require("sequelize");
const sequelize = require("../../db/db");

const Product = sequelize.define("Product", {
  productName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productType: DataTypes.STRING,
  salesPrice: DataTypes.FLOAT,
  costPrice: DataTypes.FLOAT,
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

module.exports = Product;
