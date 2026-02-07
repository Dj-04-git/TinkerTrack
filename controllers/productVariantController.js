const { Product, ProductVariant } = require("../models");

exports.createVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const { attribute, value, extraPrice } = req.body;

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = await ProductVariant.create({
      attribute,
      value,
      extraPrice,
      ProductId: productId
    });

    res.status(201).json(variant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
