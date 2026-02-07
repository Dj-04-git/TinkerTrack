const express = require("express");
const cors = require("cors");

require("../db/db");

const productRoutes = require("./routes/productRoutes");
const productVariantRoutes = require("./routes/productVariantRoutes");
const recurringPlanRoutes = require("./routes/recurringPlanRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
app.use(
  cors({
    origin: ["http://localhost:4321"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/products", productVariantRoutes);
app.use("/plans", recurringPlanRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
