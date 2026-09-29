const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   SHADOW RANCH - EINSTELLUNGEN
========================================================= */

const ADMIN_CODE = "2580";

/* Discord */
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

/* Discord Rollen */
const BRUDERSCHAFT_ROLE_ID = "1506227153942089818";
const BUERGER_ROLE_ID = "1516382500048470076";


/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/* =========================================================
   SESSION
========================================================= */

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "shadow-ranch-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            secure:
                process.env.NODE_ENV === "production",

            httpOnly: true,

            sameSite: "lax"
        }
    })
);


/* =========================================================
   WEBSEITE
========================================================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.use(
    "/assets",
    express.static(
        path.join(
            __dirname,
            "public",
            "assets"
        )
    )
);


app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


/* =========================================================
   DISCORD LOGIN
========================================================= */

app.get("/login", (req, res) => {

    if (
        !DISCORD_CLIENT_ID ||
        !DISCORD_CLIENT_SECRET ||
        !DISCORD_REDIRECT_URI
    ) {
        return res
            .status(500)
            .send(
                "Discord Login ist auf Render nicht vollständig eingerichtet."
            );
    }

    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify"
    });

    res.redirect(
        "https://discord.com/oauth2/authorize?" +
        params.toString()
    );
});


/* =========================================================
   DISCORD CALLBACK
========================================================= */

app.get("/callback", async (req, res) => {

    try {

        const code = req.query.code;

        if (!code) {
            return res
                .status(400)
                .send("Discord-Code fehlt.");
        }


        /* -------------------------------------------------
           ACCESS TOKEN VON DISCORD
        ------------------------------------------------- */

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    client_id:
                        DISCORD_CLIENT_ID,

                    client_secret:
                        DISCORD_CLIENT_SECRET,

                    grant_type:
                        "authorization_code",

                    code:
                        code,

                    redirect_uri:
                        DISCORD_REDIRECT_URI
                })
            }
        );


        const token = await tokenResponse.json();


        if (!token.access_token) {

            console.error(
                "Discord Token Fehler:",
                token
            );

            return res
                .status(401)
                .send(
                    "Discord-Anmeldung fehlgeschlagen."
                );
        }


        /* -------------------------------------------------
           DISCORD BENUTZER
        ------------------------------------------------- */

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization:
                        `Bearer ${token.access_token}`
                }
            }
        );


        const user = await userResponse.json();


        if (!user.id) {

            console.error(
                "Discord User Fehler:",
                user
            );

            return res
                .status(401)
                .send(
                    "Discord-Benutzer konnte nicht geladen werden."
                );
        }


        /* -------------------------------------------------
           STANDARDWERTE
        ------------------------------------------------- */

        let isBruderschaft = false;
        let isBuerger = false;
        let guildMember = false;


        /* -------------------------------------------------
           DISCORD SERVER / ROLLEN PRÜFEN
        ------------------------------------------------- */

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

                    guildMember = true;


                    const roles =
                        Array.isArray(member.roles)
                            ? member.roles
                            : [];


                    isBruderschaft =
                        roles.includes(
                            BRUDERSCHAFT_ROLE_ID
                        );


                    isBuerger =
                        roles.includes(
                            BUERGER_ROLE_ID
                        );

                } else {

                    const errorText =
                        await memberResponse.text();

                    console.error(
                        "Discord Rollenprüfung:",
                        memberResponse.status,
                        errorText
                    );

                }

            } catch (roleError) {

                console.error(
                    "Rollenprüfung fehlgeschlagen:",
                    roleError
                );

            }

        }


        /* -------------------------------------------------
           SESSION SPEICHERN
        ------------------------------------------------- */

        req.session.user = {

            id:
                user.id,

            username:
                user.username,

            global_name:
                user.global_name ||
                user.username,

            avatar:
                user.avatar,

            guildMember:
                guildMember,

            isBruderschaft:
                isBruderschaft,

            isBuerger:
                isBuerger

        };


        console.log(
            "Discord Login:",
            req.session.user.global_name,
            "| Bruderschaft:",
            isBruderschaft,
            "| Bürger:",
            isBuerger
        );


        res.redirect("/");

    } catch (error) {

        console.error(
            "Discord Callback Fehler:",
            error
        );

        res
            .status(500)
            .send(
                "Fehler beim Discord-Login."
            );
    }

});


/* =========================================================
   AKTUELLER BENUTZER
========================================================= */

app.get("/api/me", (req, res) => {

    res.json({

        loggedIn:
            !!req.session.user,

        user:
            req.session.user ||
            null

    });

});


/* =========================================================
   LOGOUT
========================================================= */

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");

    });

});


/* =========================================================
   BEWERBUNGEN
========================================================= */

let applications = [];

let nextApplicationId = 1;


/* =========================================================
   BEWERBUNG ABSENDEN
========================================================= */

app.post(
    "/api/applications",
    (req, res) => {

        if (!req.session.user) {

            return res
                .status(401)
                .json({
                    error:
                        "Du musst dich zuerst mit Discord anmelden."
                });

        }


        const icName =
            String(
                req.body.icName || ""
            ).trim();


        const oocAge =
            String(
                req.body.oocAge || ""
            ).trim();


        if (!icName || !oocAge) {

            return res
                .status(400)
                .json({
                    error:
                        "IC-Name und OOC-Alter müssen ausgefüllt werden."
                });

        }


        /* -------------------------------------------------
           NEUE BEWERBUNG
        ------------------------------------------------- */

        const application = {

            id:
                String(
                    nextApplicationId++
                ),

            icName:
                icName,

            oocAge:
                oocAge,

            status:
                "offen",

            discordId:
                req.session.user.id,

            discordName:
                req.session.user.global_name ||
                req.session.user.username,

            createdAt:
                new Date().toISOString()

        };


        applications.push(
            application
        );


        console.log(
            "Neue Bewerbung:",
            application
        );


        res.json({

            success:
                true,

            application:
                application

        });

    }
);


/* =========================================================
   ADMIN PRÜFUNG
========================================================= */

function isAdmin(req) {

    return (
        req.session.user &&
        req.session.user.isBruderschaft === true
    );

}


/* =========================================================
   ADMIN STATUS
========================================================= */

app.get(
    "/api/admin/check",
    (req, res) => {

        res.json({

            loggedIn:
                !!req.session.user,

            admin:
                isAdmin(req),

            isBruderschaft:
                !!(
                    req.session.user &&
                    req.session.user.isBruderschaft
                ),

            isBuerger:
                !!(
                    req.session.user &&
                    req.session.user.isBuerger
                )

        });

    }
);


/* =========================================================
   ADMIN CODE PRÜFEN
========================================================= */

app.post(
    "/api/admin/login",
    (req, res) => {

        if (!req.session.user) {

            return res
                .status(401)
                .json({
                    success: false,
                    error:
                        "Du musst dich zuerst mit Discord anmelden."
                });

        }


        if (!isAdmin(req)) {

            return res
                .status(403)
                .json({
                    success: false,
                    error:
                        "Du besitzt nicht die Bruderschaft-Rolle."
                });

        }


        const code =
            String(
                req.body.code || ""
            ).trim();


        if (code !== ADMIN_CODE) {

            return res
                .status(401)
                .json({
                    success: false,
                    error:
                        "Der Admin-Code ist falsch."
                });

        }


        req.session.adminAuthenticated = true;


        res.json({
            success: true
        });

    }
);


/* =========================================================
   ADMIN AUTHENTIFIZIERUNG
========================================================= */

function isAdminAuthenticated(req) {

    return (
        isAdmin(req) &&
        req.session.adminAuthenticated === true
    );

}


/* =========================================================
   ALLE BEWERBUNGEN
========================================================= */

app.get(
    "/api/applications",
    (req, res) => {

        if (!isAdminAuthenticated(req)) {

            return res
                .status(403)
                .json({
                    error:
                        "Keine Admin-Berechtigung."
                });

        }


        res.json(
            applications
        );

    }
);


/* =========================================================
   EINZELNE BEWERBUNG
========================================================= */

app.get(
    "/api/applications/:id",
    (req, res) => {

        if (!isAdminAuthenticated(req)) {

            return res
                .status(403)
                .json({
                    error:
                        "Keine Admin-Berechtigung."
                });

        }


        const application =
            applications.find(
                app =>
                    app.id ===
                    req.params.id
            );


        if (!application) {

            return res
                .status(404)
                .json({
                    error:
                        "Bewerbung nicht gefunden."
                });

        }


        res.json(
            application
        );

    }
);


/* =========================================================
   BEWERBUNG ÄNDERN
========================================================= */

app.put(
    "/api/applications/:id",
    (req, res) => {

        if (!isAdminAuthenticated(req)) {

            return res
                .status(403)
                .json({
                    error:
                        "Keine Admin-Berechtigung."
                });

        }


        const application =
            applications.find(
                app =>
                    app.id ===
                    req.params.id
            );


        if (!application) {

            return res
                .status(404)
                .json({
                    error:
                        "Bewerbung nicht gefunden."
                });

        }


        if (
            req.body.icName !== undefined
        ) {

            application.icName =
                String(
                    req.body.icName
                ).trim();

        }


        if (
            req.body.oocAge !== undefined
        ) {

            application.oocAge =
                String(
                    req.body.oocAge
                ).trim();

        }


        if (
            req.body.status !== undefined
        ) {

            const allowedStatuses = [

                "offen",
                "angenommen",
                "abgelehnt"

            ];


            if (
                !allowedStatuses.includes(
                    req.body.status
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Ungültiger Status."
                    });

            }


            application.status =
                req.body.status;

        }


        res.json({

            success:
                true,

            application:
                application

        });

    }
);


/* =========================================================
   BEWERBUNG ANNEHMEN
========================================================= */

app.post(
    "/api/applications/:id/accept",
    (req, res) => {

        if (!isAdminAuthenticated(req)) {

            return res
                .status(403)
                .json({
                    error:
                        "Keine Admin-Berechtigung."
                });

        }


        const application =
            applications.find(
                app =>
                    app.id ===
                    req.params.id
            );


        if (!application) {

            return res
                .status(404)
                .json({
                    error:
                        "Bewerbung nicht gefunden."
                });

        }


        application.status =
            "angenommen";


        res.json({

            success:
                true,

            application:
                application

        });

    }
);


/* =========================================================
   BEWERBUNG ABLEHNEN
========================================================= */

app.post(
    "/api/applications/:id/reject",
    (req, res) => {

        if (!isAdminAuthenticated(req)) {

            return res
                .status(403)
                .json({
                    error:
                        "Keine Admin-Berechtigung."
                });

        }


        const application =
            applications.find(
                app =>
                    app.id ===
                    req.params.id
            );


        if (!application) {

            return res
                .status(404)
                .json({
                    error:
                        "Bewerbung nicht gefunden."
                });

        }


        application.status =
            "abgelehnt";


        res.json({

            success:
                true,

            application:
                application

        });

    }
);


/* =========================================================
   BEWERBUNG LÖSCHEN
========================================================= */

app.delete(
    "/api/applications/:id",
    (req, res) => {

        if (!isAdminAuthenticated(req)) {

            return res
                .status(403)
                .json({
                    error:
                        "Keine Admin-Berechtigung."
                });

        }


        const index =
            applications.findIndex(
                app =>
                    app.id ===
                    req.params.id
            );


        if (index === -1) {

            return res
                .status(404)
                .json({
                    error:
                        "Bewerbung nicht gefunden."
                });

        }


        applications.splice(
            index,
            1
        );


        res.json({
            success:
                true
        });

    }
);


/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
    "/api/admin/logout",
    (req, res) => {

        req.session.adminAuthenticated =
            false;

        res.json({
            success:
                true
        });

    }
);


/* =========================================================
   SERVER START
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Shadow Ranch läuft auf Port ${PORT}`
        );

    }
);
