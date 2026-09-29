const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET || "shadow-ranch-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

// Öffentliche Webseite
app.use(express.static(path.join(__dirname, "public")));

// Assets
app.use("/assets", express.static(path.join(__dirname, "public", "assets")));

// Startseite
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Discord Login
app.get("/login", (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify"
    });

    res.redirect(
        "https://discord.com/oauth2/authorize?" + params.toString()
    );
});

// Discord Callback
app.get("/callback", async (req, res) => {
    try {
        const code = req.query.code;

        if (!code) {
            return res.status(400).send("Discord-Code fehlt.");
        }

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: process.env.DISCORD_CLIENT_ID,
                    client_secret: process.env.DISCORD_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: process.env.DISCORD_REDIRECT_URI
                })
            }
        );

        const token = await tokenResponse.json();

        if (!token.access_token) {
            console.error(token);
            return res.status(401).send("Discord-Anmeldung fehlgeschlagen.");
        }

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization: `Bearer ${token.access_token}`
                }
            }
        );

        const user = await userResponse.json();

        req.session.user = {
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar
        };

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Fehler beim Discord-Login.");
    }
});

// Angemeldeten Benutzer anzeigen
app.get("/api/me", (req, res) => {
    res.json({
        loggedIn: !!req.session.user,
        user: req.session.user || null
    });
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`Shadow Ranch läuft auf Port ${PORT}`);
});
