const express = require("express");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "shadow-ranch-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: "lax"
    }
}));
const path = require("path");

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

res.sendFile(path.join(__dirname, "index.html"));;
res.sendFile(path.join(__dirname, "public", "index.html"));

});

app.get("/login", (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify guilds.members.read"
    });

    res.redirect(
        "https://discord.com/oauth2/authorize?" + params.toString()
    );
});

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

app.get("/api/me", (req, res) => {
    res.json({
        loggedIn: !!req.session.user,
        user: req.session.user || null
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(PORT, () => {
    console.log(`Shadow Ranch läuft auf Port ${PORT}`);
});
