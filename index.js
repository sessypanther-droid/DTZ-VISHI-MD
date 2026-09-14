const express = require("express");
const path = require("path");
const fs = require("fs");

const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("baileys");

const app = express();
const PORT = process.env.PORT || 8000;
const AUTH_DIR = path.join(__dirname, "auth_info");

fs.mkdirSync(AUTH_DIR, { recursive: true });

const activeSockets = new Map();

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "DTZ-VISHI-MD"
  });
});

app.get("/code", async (req, res) => {
  const number = String(req.query.number || "")
    .replace(/\D/g, "");

  if (number.length < 10 || number.length > 15) {
    return res.status(400).json({
      error: "Enter a valid WhatsApp number with country code."
    });
  }

  try {
    let socket = activeSockets.get(number);

    if (!socket) {
      const authPath = path.join(AUTH_DIR, number);
      fs.mkdirSync(authPath, { recursive: true });

      const { state, saveCreds } =
        await useMultiFileAuthState(authPath);

      socket = makeWASocket({
        auth: state,
        printQRInTerminal: false
      });

      socket.ev.on("creds.update", saveCreds);

      socket.ev.on("connection.update", ({ connection }) => {
        if (connection === "close") {
          activeSockets.delete(number);
        }
      });

      activeSockets.set(number, socket);

      // Give Baileys time to initialize before requesting the code.
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    const code = await socket.requestPairingCode(number);

    res.json({ code });
  } catch (error) {
    console.error("Pairing error:", error);

    res.status(500).json({
      error: "Could not generate pairing code.",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DTZ-VISHI-MD running on port ${PORT}`);
});
