const express = require("express");

require("./db/db"); // initialize DB

const productRoutes = require("./routes/productRoutes");
const productVariantRoutes = require("./routes/productVariantRoutes");
const recurringPlanRoutes = require("./routes/recurringPlanRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

const app = express();
app.use(express.json());

app.use("/products", productRoutes);
app.use("/products", productVariantRoutes);
app.use("/plans", recurringPlanRoutes);
app.use("/subscriptions", subscriptionRoutes);


app.listen(3000, () => {
  console.log("Server running on port 3000");
});
