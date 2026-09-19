const express = require("express");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");

const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("baileys");

const app = express();
const PORT = process.env.PORT || 8000;
const AUTH_DIR = path.join(__dirname, "auth_info");

fs.mkdirSync(AUTH_DIR, { recursive: true });

const activeSockets = new Map();

const MONGODB_URI = "mongodb+srv://whatsappminibot_db_user:uEwJp0ACjFtHvZGk@cluster0.n4asy3o.mongodb.net/";

let mongoClient = null;
let mongoState = MONGODB_URI ? "connecting" : "not-configured";

async function connectToMongoDB() {
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI is not configured; MongoDB features are disabled.");
    return;
  }

  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    await mongoClient.db().command({ ping: 1 });
    mongoState = "connected";
    console.log("MongoDB connected");
  } catch (error) {
    mongoState = "error";
    console.error("MongoDB connection failed:", error.message);
  }
}

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "DTZ-VISHI-MD",
    database: mongoState
  });
});

app.get("/status", (req, res) => {
  const active = activeSockets.size;

  res.json({
    status: "ok",
    database: mongoState,
    active,
    total: active
  });
});

app.get(["/code", "/pair"], async (req, res) => {
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

connectToMongoDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DTZ-VISHI-MD running on port ${PORT}`);
  });
});