const express = require("express");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

const PORT = process.env.PORT || 8000;
const AUTH_DIR = path.join(__dirname, "auth_info");

fs.mkdirSync(AUTH_DIR, { recursive: true });

const activeSockets = new Map();

const MONGODB_URI = process.env.MONGODB_URI;

let mongoClient = null;
let mongoState = MONGODB_URI ? "connecting" : "not-configured";

/* =========================
   MONGODB
========================= */

async function connectToMongoDB() {
  if (!MONGODB_URI) {
    console.warn(
      "MONGODB_URI is not configured; MongoDB features are disabled."
    );
    return;
  }

  try {
    mongoClient = new MongoClient(MONGODB_URI);

    await mongoClient.connect();

    await mongoClient.db().command({
      ping: 1
    });

    mongoState = "connected";

    console.log("MongoDB connected");
  } catch (error) {
    mongoState = "error";

    console.error(
      "MongoDB connection failed:",
      error.message
    );
  }
}

/* =========================
   EXPRESS
========================= */

app.use(express.json());

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "DTZ-VISHI-MD",
    database: mongoState
  });
});

/* =========================
   STATUS
========================= */

app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    database: mongoState,
    active: activeSockets.size,
    total: activeSockets.size
  });
});

/* =========================
   CREATE SOCKET
========================= */

async function createSocket(number) {
  const authPath = path.join(
    AUTH_DIR,
    number
  );

  fs.mkdirSync(authPath, {
    recursive: true
  });

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(authPath);

  const socket = makeWASocket({
    auth: state,

    printQRInTerminal: false,

    browser: [
      "DTZ-VISHI-MD",
      "Chrome",
      "1.0.0"
    ],

    markOnlineOnConnect: false,

    generateHighQualityLinkPreview: false,

    syncFullHistory: false,

    connectTimeoutMs: 60000,

    defaultQueryTimeoutMs: 60000,

    keepAliveIntervalMs: 30000
  });

  /* =========================
     SAVE CREDENTIALS
  ========================= */

  socket.ev.on(
    "creds.update",
    saveCreds
  );

  /* =========================
     CONNECTION UPDATE
  ========================= */

  socket.ev.on(
    "connection.update",
    async ({
      connection,
      lastDisconnect
    }) => {
      console.log(
        `[${number}] Connection:`,
        connection
      );

      if (connection === "open") {
        console.log(
          `[${number}] WhatsApp connected successfully.`
        );

        activeSockets.set(
          number,
          socket
        );
      }

      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output
            ?.statusCode;

        const errorMessage =
          lastDisconnect?.error?.message ||
          "Unknown error";

        console.error(
          `[${number}] Connection closed`
        );

        console.error(
          `[${number}] Status:`,
          statusCode
        );

        console.error(
          `[${number}] Error:`,
          errorMessage
        );

        activeSockets.delete(number);

        /* =========================
           LOGOUT
        ========================= */

        if (
          statusCode ===
          DisconnectReason.loggedOut
        ) {
          console.log(
            `[${number}] Session logged out.`
          );

          return;
        }

        /* =========================
           RECONNECT
        ========================= */

        console.log(
          `[${number}] Reconnecting...`
        );

        setTimeout(async () => {
          try {
            const newSocket =
              await createSocket(number);

            activeSockets.set(
              number,
              newSocket
            );
          } catch (error) {
            console.error(
              `[${number}] Reconnect failed:`,
              error.message
            );
          }
        }, 3000);
      }
    }
  );

  return socket;
}

/* =========================
   PAIRING CODE
========================= */

app.get(
  ["/code", "/pair"],
  async (req, res) => {
    const number = String(
      req.query.number || ""
    ).replace(/\D/g, "");

    if (
      number.length < 10 ||
      number.length > 15
    ) {
      return res.status(400).json({
        error:
          "Enter a valid WhatsApp number with country code."
      });
    }

    try {
      let socket =
        activeSockets.get(number);

      /* =========================
         CREATE NEW SOCKET
      ========================= */

      if (!socket) {
        socket =
          await createSocket(number);

        activeSockets.set(
          number,
          socket
        );

        /*
         * Wait a little for Baileys
         * to initialize.
         */

        await new Promise(
          resolve =>
            setTimeout(resolve, 3000)
        );
      }

      /* =========================
         ALREADY REGISTERED
      ========================= */

      if (
        socket.authState?.creds
          ?.registered
      ) {
        return res.status(400).json({
          error:
            "This number is already connected. Delete its session before pairing again."
        });
      }

      /* =========================
         REQUEST PAIRING CODE
      ========================= */

      const code =
        await socket.requestPairingCode(
          number
        );

      console.log(
        `[${number}] Pairing code generated:`,
        code
      );

      return res.json({
        success: true,
        number,
        code
      });

    } catch (error) {
      console.error(
        "Pairing error:",
        error
      );

      activeSockets.delete(number);

      return res.status(500).json({
        success: false,
        error:
          "Could not generate pairing code.",
        details:
          error.message || String(error)
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

async function startServer() {
  await connectToMongoDB();

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `DTZ-VISHI-MD running on port ${PORT}`
      );

      console.log(
        `Port: ${PORT}`
      );

      console.log(
        `Pair URL: /pair?number=947xxxxxxxxx`
      );
    }
  );
}

startServer();

/* =========================
   GLOBAL ERROR HANDLING
========================= */

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);