const express = require("express");
const { sequelize } = require("./models");

const productRoutes = require("./routes/productRoutes");
const productVariantRoutes = require("./routes/productVariantRoutes");
const recurringPlanRoutes = require("./routes/recurringPlanRoutes");

const app = express();
app.use(express.json());

app.use("/products", productRoutes);
app.use("/products", productVariantRoutes);
app.use("/plans", recurringPlanRoutes);

sequelize.sync().then(() => {
  console.log("Database synced");
  app.listen(3000, () => console.log("Server running on port 3000"));
});
