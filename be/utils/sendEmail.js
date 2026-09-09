// utils/sendEmail.js
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

/**
 * Gửi email
 * @param {Object} options - Tùy chọn email
 * @param {String} options.to - Người nhận
 * @param {String} options.subject - Tiêu đề
 * @param {String} options.template - Tên template (không có đuôi .html)
 * @param {Object} options.context - Dữ liệu để đưa vào template
 */
const sendEmail = async (options) => {
  if (
    process.env.EMAIL_TRANSPORT === "local" &&
    process.env.NODE_ENV !== "production"
  ) {
    const directory = path.resolve(__dirname, "../../.local/mail");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(
        directory,
        `${Date.now()}-${require("crypto").randomUUID()}.json`
      ),
      JSON.stringify(options, null, 2)
    );
    return;
  }
  // Tạo transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Đọc template
  const templatePath = path.join(
    __dirname,
    `../templates/emails/${options.template}.html`
  );
  const source = fs.readFileSync(templatePath, "utf8");
  const template = handlebars.compile(source);
  const html = template(options.context);

  // Thiết lập email
  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html,
  };

  // Gửi email
  await transporter.sendMail(message);
};
module.exports = sendEmail;
