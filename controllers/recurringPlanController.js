const { Product, RecurringPlan } = require("../models");

exports.createPlan = async (req, res) => {
  try {
    const plan = await RecurringPlan.create(req.body);
    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = await RecurringPlan.findAll();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.assignPlanToProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { planId } = req.body;

    const product = await Product.findByPk(productId);
    const plan = await RecurringPlan.findByPk(planId);

    if (!product || !plan) {
      return res.status(404).json({ message: "Product or Plan not found" });
    }

    await product.addRecurringPlan(plan);
    res.json({ message: "Plan assigned to product" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
