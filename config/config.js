require("dotenv").config();

console.log("ENV CHECK:");
console.log(process.env.JWT_SECRET);
console.log(process.env.EMAIL);
console.log(process.env.EMAIL_PASS);

module.exports.config = {
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.EMAIL,
  EMAIL_PASS: process.env.EMAIL_PASS,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL
};
