const express = require("express");
const cors = require("cors");

require("../db/db"); 

const productRoutes = require("./routes/productRoutes");
const productVariantRoutes = require("./routes/productVariantRoutes");
const recurringPlanRoutes = require("./routes/recurringPlanRoutes");
const quotationTemplateRoutes = require("./routes/quotationTemplateRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const authRoutes = require("./routes/authRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/products", productVariantRoutes);
app.use("/plans", recurringPlanRoutes);
app.use("/quotation-templates", quotationTemplateRoutes);
app.use("/invoices", invoiceRoutes);
app.use("/subscriptions", subscriptionRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
