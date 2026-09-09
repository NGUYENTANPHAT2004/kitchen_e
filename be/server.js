const app = require("./app");
const connectDB = require("./config/db");
const http = require("http");
const socketService = require("./services/socket.service");
const config = require("./config/default");

const server = http.createServer(app);
socketService.initialize(server);
connectDB()
  .then(() => {
    server.listen(config.port, () => {
      console.log(
        `API ready at ${
          process.env.API_URL || `http://localhost:${config.port}`
        }`
      );
      console.log(`Frontend: ${process.env.FRONTEND_URL || "not configured"}`);
    });
  })
  .catch((error) => {
    console.error("Unable to start server:", error.message);
    process.exitCode = 1;
  });
process.on("unhandledRejection", (error) =>
  console.error("Unhandled rejection:", error)
);
