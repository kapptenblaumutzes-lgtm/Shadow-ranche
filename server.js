const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================
// DISCORD EINSTELLUNGEN
// =====================================

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// =====================================
// ROLLEN
// =====================================

const BRUDERSCHAFT_ROLE_ID = "1506227153942089818";
const BUERGER_ROLE_ID = "1516382500048470076";

// =====================================
// ADMIN
// =====================================

const ADMIN_CODE = "2580";

// =====================================
// SESSION
// =====================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "shadow-ranch-secret",

        resave: false,

        saveUninitialized: false,

        proxy: true,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// =====================================
// WEBSITE
// =====================================

app.use(express.static(path.join(__dirname, "public")));

// =====================================
// DISCORD LOGIN
// =====================================

app.get("/login", (req, res) => {

    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
        return res.status(500).send(
            "Discord Login ist nicht eingerichtet."
        );
    }

    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify"
    });

    res.redirect(
        `https://discord.com/oauth2/authorize?${params.toString()}`
    );
});

// =====================================
// DISCORD CALLBACK
// =====================================

app.get("/callback", async (req, res) => {

    try {

        const code = req.query.code;

        if (!code) {
            return res.status(400).send(
                "Kein Discord-Code vorhanden."
            );
        }

        // =================================
        // TOKEN HOLEN
        // =================================

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    client_id: DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: DISCORD_REDIRECT_URI
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {

            console.error(
                "Discord Token Fehler:",
                tokenData
            );

            return res.status(500).send(
                "Discord Login fehlgeschlagen."
            );
        }

        // =================================
        // DISCORD USER
        // =================================

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization:
                        `Bearer ${tokenData.access_token}`
                }
            }
        );

        const user = await userResponse.json();

        if (!userResponse.ok) {

            console.error(
                "Discord User Fehler:",
                user
            );

            return res.status(500).send(
                "Discord Benutzer konnte nicht geladen werden."
            );
        }

        console.log(
            "Discord Login:",
            user.username
        );

        // =================================
        // SESSION USER
        // =================================

        req.session.user = {

            id: user.id,

            username:
                user.username,

            global_name:
                user.global_name ||
                user.username,

            avatar:
                user.avatar || null,

            isBruderschaft: false,

            isBuerger: false,

            guildMember: false
        };

        // =================================
        // ROLLEN PRÜFEN
        // =================================

        if (
            DISCORD_GUILD_ID &&
            DISCORD_BOT_TOKEN
        ) {

            try {

                const memberResponse =
                    await fetch(
                        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${user.id}`,
                        {
                            headers: {
                                Authorization:
                                    `Bot ${DISCORD_BOT_TOKEN}`
                            }
                        }
                    );

                if (memberResponse.ok) {

                    const member =
                        await memberResponse.json();

                    const roles =
                        member.roles || [];

                    // =================================
                    // BRUDERSCHAFT
                    // =================================

                    req.session.user.isBruderschaft =
                        roles.includes(
                            BRUDERSCHAFT_ROLE_ID
                        );

                    // =================================
                    // BÜRGER
                    // =================================

                    req.session.user.isBuerger =
                        roles.includes(
                            BUERGER_ROLE_ID
                        );

                    req.session.user.guildMember = true;

                    console.log(
                        "Discord Rollen:",
                        roles
                    );

                    console.log(
                        "Bruderschaft:",
                        req.session.user.isBruderschaft
                    );

                    console.log(
                        "Bürger:",
                        req.session.user.isBuerger
                    );

                } else {

                    const errorText =
                        await memberResponse.text();

                    console.error(
                        "Rollenprüfung fehlgeschlagen:",
                        memberResponse.status,
                        errorText
                    );
                }

            } catch (error) {

                console.error(
                    "Rollenprüfung Fehler:",
                    error
                );
            }

        } else {

            console.error(
                "DISCORD_GUILD_ID oder DISCORD_BOT_TOKEN fehlt."
            );
        }

        // =================================
        // SESSION SPEICHERN
        // =================================

        req.session.save((error) => {

            if (error) {

                console.error(
                    "Session Save Fehler:",
                    error
                );

                return res.status(500).send(
                    "Session konnte nicht gespeichert werden."
                );
            }

            res.redirect("/");
        });

    } catch (error) {

        console.error(
            "Discord Callback Fehler:",
            error
        );

        res.status(500).send(
            "Discord Login fehlgeschlagen."
        );
    }
});

// =====================================
// AKTUELLER USER
// =====================================

app.get("/api/me", (req, res) => {

    if (!req.session.user) {

        return res.json({
            loggedIn: false
        });
    }

    res.json({

        loggedIn: true,

        user: req.session.user
    });
});

// =====================================
// LOGOUT
// =====================================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");
    });
});

// =====================================
// BEWERBUNGEN
// =====================================

let applications = [];

let nextApplicationId = 1;

// =====================================
// BEWERBUNG ERSTELLEN
// =====================================

app.post(
    "/api/applications",
    (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "Bitte zuerst mit Discord anmelden."
            });
        }

        const {
            icName,
            oocAge,
            discordName,
            text
        } = req.body;

        if (!icName || !oocAge) {

            return res.status(400).json({
                error:
                    "Bitte alle Pflichtfelder ausfüllen."
            });
        }

        const application = {

            id:
                nextApplicationId++,

            icName,

            oocAge,

            discordName:
                discordName ||
                req.session.user.global_name ||
                req.session.user.username,

            discordId:
                req.session.user.id,

            text:
                text || "",

            status:
                "offen",

            createdAt:
                new Date().toISOString()
        };

        applications.push(
            application
        );

        res.json({

            success: true,

            application
        });
    }
);

// =====================================
// ADMIN CHECK
// =====================================

function isAdminAuthenticated(req) {

    return (

        req.session.user &&

        req.session.user.isBruderschaft === true &&

        req.session.adminAuthenticated === true
    );
}

// =====================================
// ADMIN STATUS
// =====================================

app.get(
    "/api/admin/check",
    (req, res) => {

        if (!req.session.user) {

            return res.json({

                loggedIn: false,

                admin: false,

                isBruderschaft: false,

                isBuerger: false
            });
        }

        res.json({

            loggedIn: true,

            admin:
                isAdminAuthenticated(req),

            isBruderschaft:
                req.session.user.isBruderschaft === true,

            isBuerger:
                req.session.user.isBuerger === true
        });
    }
);

// =====================================
// ADMIN LOGIN
// =====================================

app.post(
    "/api/admin/login",
    (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "Du musst dich zuerst mit Discord anmelden."
            });
        }

        if (
            !req.session.user.isBruderschaft
        ) {

            return res.status(403).json({
                error:
                    "Du hast keine Bruderschaft-Rolle."
            });
        }

        const {
            code
        } = req.body;

        if (code !== ADMIN_CODE) {

            return res.status(401).json({
                error:
                    "Falscher Admin-Code."
            });
        }

        req.session.adminAuthenticated =
            true;

        req.session.save(
            (error) => {

                if (error) {

                    console.error(
                        "Admin Session Fehler:",
                        error
                    );

                    return res.status(500).json({
                        error:
                            "Session konnte nicht gespeichert werden."
                    });
                }

                res.json({
                    success: true
                });
            }
        );
    }
);

// =====================================
// BEWERBUNGEN ABRUFEN
// =====================================

app.get(
    "/api/applications",
    (req, res) => {

        if (
            !isAdminAuthenticated(req)
        ) {

            return res.status(403).json({
                error:
                    "Keine Admin-Berechtigung."
            });
        }

        res.json(
            applications
        );
    }
);

// =====================================
// EINZELNE BEWERBUNG
// =====================================

app.get(
    "/api/applications/:id",
    (req, res) => {

        if (
            !isAdminAuthenticated(req)
        ) {

            return res.status(403).json({
                error:
                    "Keine Admin-Berechtigung."
            });
        }

        const id =
            Number(req.params.id);

        const application =
            applications.find(
                a => a.id === id
            );

        if (!application) {

            return res.status(404).json({
                error:
                    "Bewerbung nicht gefunden."
            });
        }

        res.json(
            application
        );
    }
);

// =====================================
// BEWERBUNG ANNEHMEN
// =====================================

app.post(
    "/api/applications/:id/accept",
    (req, res) => {

        if (
            !isAdminAuthenticated(req)
        ) {

            return res.status(403).json({
                error:
                    "Keine Admin-Berechtigung."
            });
        }

        const id =
            Number(req.params.id);

        const application =
            applications.find(
                a => a.id === id
            );

        if (!application) {

            return res.status(404).json({
                error:
                    "Bewerbung nicht gefunden."
            });
        }

        application.status =
            "angenommen";

        res.json({

            success: true,

            application
        });
    }
);

// =====================================
// BEWERBUNG ABLEHNEN
// =====================================

app.post(
    "/api/applications/:id/reject",
    (req, res) => {

        if (
            !isAdminAuthenticated(req)
        ) {

            return res.status(403).json({
                error:
                    "Keine Admin-Berechtigung."
            });
        }

        const id =
            Number(req.params.id);

        const application =
            applications.find(
                a => a.id === id
            );

        if (!application) {

            return res.status(404).json({
                error:
                    "Bewerbung nicht gefunden."
            });
        }

        application.status =
            "abgelehnt";

        res.json({

            success: true,

            application
        });
    }
);

// =====================================
// BEWERBUNG LÖSCHEN
// =====================================

app.delete(
    "/api/applications/:id",
    (req, res) => {

        if (
            !isAdminAuthenticated(req)
        ) {

            return res.status(403).json({
                error:
                    "Keine Admin-Berechtigung."
            });
        }

        const id =
            Number(req.params.id);

        const index =
            applications.findIndex(
                a => a.id === id
            );

        if (index === -1) {

            return res.status(404).json({
                error:
                    "Bewerbung nicht gefunden."
            });
        }

        applications.splice(
            index,
            1
        );

        res.json({
            success: true
        });
    }
);

// =====================================
// ADMIN LOGOUT
// =====================================

app.post(
    "/api/admin/logout",
    (req, res) => {

        req.session.adminAuthenticated =
            false;

        req.session.save(
            () => {

                res.json({
                    success: true
                });
            }
        );
    }
);

// =====================================
// SERVER START
// =====================================

app.listen(
    PORT,
    () => {

        console.log(
            `Shadow Ranch läuft auf Port ${PORT}`
        );
    }
);
