const db = require("./db");

// Seed sample data
const seedData = () => {
  console.log("Seeding database...");

  // Insert sample products
  const products = [
    { productName: "Pulse Analytics Suite", productType: "Analytics", salesPrice: 129, costPrice: 80 },
    { productName: "Retention Lab", productType: "Automation", salesPrice: 89, costPrice: 50 },
    { productName: "Quotient Billing Studio", productType: "Billing", salesPrice: 159, costPrice: 100 },
    { productName: "Customer Insights Pro", productType: "Analytics", salesPrice: 199, costPrice: 120 },
    { productName: "Workflow Automator", productType: "Automation", salesPrice: 79, costPrice: 45 }
  ];

  products.forEach((product) => {
    db.run(
      `INSERT OR IGNORE INTO products (productName, productType, salesPrice, costPrice) VALUES (?, ?, ?, ?)`,
      [product.productName, product.productType, product.salesPrice, product.costPrice],
      function (err) {
        if (err) console.error("Error inserting product:", err.message);
        else if (this.lastID) console.log(`Inserted product: ${product.productName} with ID ${this.lastID}`);
      }
    );
  });

  // Insert sample recurring plans
  const plans = [
    { planName: "Monthly Plan", price: 129, billingPeriod: "monthly" },
    { planName: "6 Month Plan", price: 690, billingPeriod: "6 months" },
    { planName: "Yearly Plan", price: 1180, billingPeriod: "yearly" }
  ];

  plans.forEach((plan) => {
    db.run(
      `INSERT OR IGNORE INTO recurring_plans (planName, price, billingPeriod) VALUES (?, ?, ?)`,
      [plan.planName, plan.price, plan.billingPeriod],
      function (err) {
        if (err) console.error("Error inserting plan:", err.message);
        else if (this.lastID) console.log(`Inserted plan: ${plan.planName} with ID ${this.lastID}`);
      }
    );
  });

  // Assign plans to products (after a delay to ensure products and plans are inserted)
  setTimeout(() => {
    // Assign all plans to product 1
    for (let planId = 1; planId <= 3; planId++) {
      db.run(
        `INSERT OR IGNORE INTO product_plans (productId, planId) VALUES (?, ?)`,
        [1, planId],
        function (err) {
          if (err) console.error("Error assigning plan:", err.message);
          else console.log(`Assigned plan ${planId} to product 1`);
        }
      );
    }

    // Assign all plans to product 2
    for (let planId = 1; planId <= 3; planId++) {
      db.run(
        `INSERT OR IGNORE INTO product_plans (productId, planId) VALUES (?, ?)`,
        [2, planId],
        function (err) {
          if (err) console.error("Error assigning plan:", err.message);
          else console.log(`Assigned plan ${planId} to product 2`);
        }
      );
    }

    // Assign all plans to product 3
    for (let planId = 1; planId <= 3; planId++) {
      db.run(
        `INSERT OR IGNORE INTO product_plans (productId, planId) VALUES (?, ?)`,
        [3, planId],
        function (err) {
          if (err) console.error("Error assigning plan:", err.message);
          else console.log(`Assigned plan ${planId} to product 3`);
        }
      );
    }
  }, 500);

  // Insert sample variants
  setTimeout(() => {
    const variants = [
      { productId: 1, attribute: "Tier", value: "Growth (up to 10k customers)", extraPrice: 0 },
      { productId: 1, attribute: "Tier", value: "Scale (up to 50k customers)", extraPrice: 50 },
      { productId: 1, attribute: "Tier", value: "Enterprise (custom)", extraPrice: 150 },
      { productId: 2, attribute: "Tier", value: "Starter (up to 5k customers)", extraPrice: 0 },
      { productId: 2, attribute: "Tier", value: "Growth (up to 25k customers)", extraPrice: 30 },
      { productId: 3, attribute: "Plan", value: "Standard (core billing)", extraPrice: 0 },
      { productId: 3, attribute: "Plan", value: "Advanced (tax + discounts)", extraPrice: 40 },
      { productId: 3, attribute: "Plan", value: "Enterprise (custom)", extraPrice: 100 }
    ];

    variants.forEach((variant) => {
      db.run(
        `INSERT OR IGNORE INTO product_variants (productId, attribute, value, extraPrice) VALUES (?, ?, ?, ?)`,
        [variant.productId, variant.attribute, variant.value, variant.extraPrice],
        function (err) {
          if (err) console.error("Error inserting variant:", err.message);
          else if (this.lastID) console.log(`Inserted variant: ${variant.value}`);
        }
      );
    });
  }, 1000);

  // Insert dummy cart data
  setTimeout(() => {
    const cartItems = [
      { 
        userId: 1, 
        productId: 1, 
        productName: "Pulse Analytics Suite", 
        planId: 1, 
        planName: "Monthly Plan", 
        variantId: 1, 
        variantName: "Tier: Growth (up to 10k customers)", 
        price: 129, 
        billingPeriod: "monthly", 
        quantity: 1 
      },
      { 
        userId: 1, 
        productId: 2, 
        productName: "Retention Lab", 
        planId: 3, 
        planName: "Yearly Plan", 
        variantId: null, 
        variantName: null, 
        price: 1180, 
        billingPeriod: "yearly", 
        quantity: 2 
      }
    ];

    cartItems.forEach((item) => {
      db.run(
        `INSERT INTO cart (userId, productId, productName, planId, planName, variantId, variantName, price, billingPeriod, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.userId, item.productId, item.productName, item.planId, item.planName, item.variantId, item.variantName, item.price, item.billingPeriod, item.quantity],
        function (err) {
          if (err) console.error("Error inserting cart item:", err.message);
          else console.log(`Inserted cart item: ${item.productName}`);
        }
      );
    });

    console.log("Seeding complete!");
  }, 1500);

  // Insert sample discounts
  setTimeout(() => {
    const discounts = [
      { 
        discountName: "SAVE10", 
        type: "PERCENTAGE", 
        value: 10, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 100,
        appliesTo: "PRODUCT",
        productId: null,
        subscriptionId: null
      },
      { 
        discountName: "FLAT50", 
        type: "FIXED", 
        value: 50, 
        minimumPurchase: 100, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 50,
        appliesTo: "PRODUCT",
        productId: null,
        subscriptionId: null
      },
      { 
        discountName: "WELCOME20", 
        type: "PERCENTAGE", 
        value: 20, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 200,
        appliesTo: "SUBSCRIPTION",
        productId: null,
        subscriptionId: null
      },
      { 
        discountName: "YEARLY15", 
        type: "PERCENTAGE", 
        value: 15, 
        minimumPurchase: 500, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 100,
        appliesTo: "SUBSCRIPTION",
        productId: null,
        subscriptionId: null
      },
      { 
        discountName: "BULK100", 
        type: "FIXED", 
        value: 100, 
        minimumPurchase: 1000, 
        minimumQuantity: 2,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 30,
        appliesTo: "PRODUCT",
        productId: null,
        subscriptionId: null
      },
      // Product-specific discount coupons
      { 
        discountName: "PULSE20", 
        type: "PERCENTAGE", 
        value: 20, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 50,
        appliesTo: "PRODUCT",
        productId: 1,
        subscriptionId: null
      },
      { 
        discountName: "RETENTION15", 
        type: "PERCENTAGE", 
        value: 15, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 50,
        appliesTo: "PRODUCT",
        productId: 2,
        subscriptionId: null
      },
      { 
        discountName: "QUOTIENT25", 
        type: "FIXED", 
        value: 25, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 50,
        appliesTo: "PRODUCT",
        productId: 3,
        subscriptionId: null
      },
      { 
        discountName: "INSIGHTS10", 
        type: "PERCENTAGE", 
        value: 10, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 50,
        appliesTo: "PRODUCT",
        productId: 4,
        subscriptionId: null
      },
      { 
        discountName: "WORKFLOW30", 
        type: "FIXED", 
        value: 30, 
        minimumPurchase: 0, 
        minimumQuantity: 0,
        startDate: "2024-01-01",
        endDate: "2027-12-31",
        limitUsage: 50,
        appliesTo: "PRODUCT",
        productId: 5,
        subscriptionId: null
      }
    ];

    discounts.forEach((discount) => {
      db.run(
        `INSERT OR IGNORE INTO discounts (discountName, type, value, minimumPurchase, minimumQuantity, startDate, endDate, limitUsage, appliesTo, productId, subscriptionId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [discount.discountName, discount.type, discount.value, discount.minimumPurchase, discount.minimumQuantity, discount.startDate, discount.endDate, discount.limitUsage, discount.appliesTo, discount.productId, discount.subscriptionId],
        function (err) {
          if (err) console.error("Error inserting discount:", err.message);
          else if (this.lastID) console.log(`Inserted discount: ${discount.discountName}`);
        }
      );
    });

    console.log("Discounts seeding complete!");
  }, 2000);
};

seedData();
