const sequelize = require("../config/database");

const Product = require("./Product");
const ProductVariant = require("./ProductVariant");
const RecurringPlan = require("./RecurringPlan");
const ProductPlan = require("./ProductPlan");

// Product → Variants
Product.hasMany(ProductVariant, { onDelete: "CASCADE" });
ProductVariant.belongsTo(Product);

// Product ↔ Recurring Plans
Product.belongsToMany(RecurringPlan, { through: ProductPlan });
RecurringPlan.belongsToMany(Product, { through: ProductPlan });

module.exports = {
  sequelize,
  Product,
  ProductVariant,
  RecurringPlan,
  ProductPlan
};
