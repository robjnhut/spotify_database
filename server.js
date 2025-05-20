const express = require("express");
const path = require("path");
const axios = require("axios");
const cors = require("cors");
const querystring = require("querystring");
const oracledb = require("oracledb");
require("dotenv").config();

const app = express();
const port = 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Cấu hình kết nối Oracle với user chính xác
async function initOracle() {
  try {
    await oracledb.createPool({
      user: "C##robjnonthi",
      password: "r123",
      connectString: "localhost:1521/orcl",
      poolMin: 1,
      poolMax: 10,
      poolTimeout: 60,
    });
    console.log("Connected to Oracle database with C##robjnonthi");
  } catch (err) {
    console.error("Error connecting to Oracle:", err.message);
  }
}

initOracle();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  const scope = "user-read-private user-read-email playlist-read-private";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
      })
  );
});

app.get("/callback", async (req, res) => {
  console.log("Callback query:", req.query);
  const code = req.query.code || null;
  if (!code) {
    console.error("No code in callback query");
    res.send("Error: No authorization code");
    return;
  }
  try {
    const response = await axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      data: querystring.stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    console.log("Token response:", response.data);
    const access_token = response.data.access_token;
    res.redirect(`/?access_token=${access_token}`);
  } catch (error) {
    console.error(
      "Error during authentication:",
      error.message,
      error.response ? error.response.data : ""
    );
    res.send("Error during authentication");
  }
});

app.get("/playlists", async (req, res) => {
  const access_token = req.query.access_token;
  if (!access_token) {
    res.status(400).send("No access token provided");
    return;
  }
  try {
    const response = await axios({
      method: "get",
      url: "https://api.spotify.com/v1/me/playlists",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    console.log("Playlists response:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching playlists:", error.message);
    res.status(500).send("Error fetching playlists");
  }
});

app.get("/search", async (req, res) => {
  const access_token = req.query.access_token;
  const query = req.query.q;
  if (!access_token || !query) {
    res.status(400).send("Missing access token or query");
    return;
  }
  try {
    const response = await axios({
      method: "get",
      url: `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=10`,
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    console.log("Search response:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Error searching tracks:", error.message);
    res.status(500).send("Error searching tracks");
  }
});

app.post("/save", async (req, res) => {
  const { id, name, artist, preview_url, image_url } = req.body;
  console.log("Saving track:", { id, name, artist, preview_url, image_url });
  if (!id || !name || !artist) {
    res.status(400).send("Missing track information");
    return;
  }
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `BEGIN
                ADD_FAVORITE(:id, :name, :artist, :preview_url, :image_url);
            END;`,
      {
        id,
        name,
        artist,
        preview_url: preview_url || null,
        image_url: image_url || null,
      },
      { autoCommit: true }
    );
    console.log("Procedure executed successfully:", result);
    res.send("Track saved successfully");
  } catch (err) {
    console.error("Error in /save route:", err.message);
    res.status(500).send("Error saving track");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err.message);
      }
    }
  }
});

app.get("/favorites", async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT id, name, artist, preview_url, image_url FROM favorites`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log("Favorites data:", result.rows); // Log để kiểm tra dữ liệu
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching favorites:", err.message);
    res.status(500).send("Error fetching favorites");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err.message);
      }
    }
  }
});

app.post("/delete", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).send("Missing track ID");
    return;
  }
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(`DELETE FROM favorites WHERE id = :id`, { id });
    await connection.commit();
    res.send("Track deleted successfully");
  } catch (err) {
    console.error("Error deleting track:", err.message);
    res.status(500).send("Error deleting track");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err.message);
      }
    }
  }
});

app.get("/favorites.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "favorites.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Client Secret: ${CLIENT_SECRET}`);
  console.log(`Redirect URI: ${REDIRECT_URI}`);
});

process.on("SIGINT", async () => {
  console.log("Closing Oracle connection pool");
  await oracledb.getPool().close(10);
  process.exit(0);
});
