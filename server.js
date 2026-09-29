const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   EINSTELLUNGEN
========================= */

const ADMIN_CODE = "2580";

// BRUDERSCHAFT-ROLLE
const DISCORD_ROLE_ID =
    "1506227153942089818";

// BÜRGER-ROLLE
const DISCORD_CITIZEN_ROLE_ID =
    "1516382500048470076";

// DISCORD SERVER
const DISCORD_GUILD_ID =
    process.env.DISCORD_GUILD_ID;

// DISCORD BOT
const DISCORD_BOT_TOKEN =
    process.env.DISCORD_BOT_TOKEN;

// DISCORD OAUTH
const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID;

const DISCORD_CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET;

const DISCORD_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI;


/* =========================
   EXPRESS
========================= */

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


/* =========================
   SESSION
========================= */

app.use(
    session({

        secret:
            process.env.SESSION_SECRET ||
            "shadow-ranch-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {

            secure:
                process.env.NODE_ENV ===
                "production",

            httpOnly: true,

            sameSite: "lax"

        }

    })
);


/* =========================
   WEBSEITE
========================= */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
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


/* =========================
   STARTSEITE
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================
   DISCORD LOGIN
========================= */

app.get("/login", (req, res) => {

    if (
        !DISCORD_CLIENT_ID ||
        !DISCORD_REDIRECT_URI
    ) {

        return res
            .status(500)
            .send(
                "Discord Login ist nicht vollständig eingerichtet."
            );

    }


    const params =
        new URLSearchParams({

            client_id:
                DISCORD_CLIENT_ID,

            redirect_uri:
                DISCORD_REDIRECT_URI,

            response_type:
                "code",

            scope:
                "identify"

        });


    res.redirect(
        "https://discord.com/oauth2/authorize?" +
        params.toString()
    );

});


/* =========================
   DISCORD CALLBACK
========================= */

app.get(
    "/callback",
    async (req, res) => {

        try {

            const code =
                req.query.code;


            if (!code) {

                return res
                    .status(400)
                    .send(
                        "Discord-Code fehlt."
                    );

            }


            const tokenResponse =
                await fetch(
                    "https://discord.com/api/oauth2/token",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/x-www-form-urlencoded"

                        },

                        body:
                            new URLSearchParams({

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


            const token =
                await tokenResponse.json();


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


            const userResponse =
                await fetch(
                    "https://discord.com/api/users/@me",
                    {

                        headers: {

                            Authorization:
                                `Bearer ${token.access_token}`

                        }

                    }
                );


            const user =
                await userResponse.json();


            /* =========================
               BENUTZER SPEICHERN
            ========================= */

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

                isBruderschaft:
                    false,

                isBuerger:
                    false

            };


            /* =========================
               DISCORD ROLLEN PRÜFEN
            ========================= */

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


                    if (
                        memberResponse.ok
                    ) {

                        const member =
                            await memberResponse.json();


                        const roles =
                            Array.isArray(
                                member.roles
                            )
                                ? member.roles
                                : [];


                        /* BRUDERSCHAFT */

                        req.session.user.isBruderschaft =
                            roles.includes(
                                DISCORD_ROLE_ID
                            );


                        /* BÜRGER */

                        req.session.user.isBuerger =
                            roles.includes(
                                DISCORD_CITIZEN_ROLE_ID
                            );

                    }

                } catch (error) {

                    console.error(
                        "Discord Rollenprüfung:",
                        error
                    );

                }

            }


            res.redirect("/");


        } catch (error) {

            console.error(error);

            res
                .status(500)
                .send(
                    "Fehler beim Discord-Login."
                );

        }

    }
);


/* =========================
   ANGEMELDETEN BENUTZER
========================= */

app.get(
    "/api/me",
    (req, res) => {

        res.json({

            loggedIn:
                !!req.session.user,

            user:
                req.session.user ||
                null

        });

    }
);


/* =========================
   LOGOUT
========================= */

app.get(
    "/logout",
    (req, res) => {

        req.session.destroy(
            () => {

                res.redirect("/");

            }
        );

    }
);


/* =========================
   BEWERBUNGEN
========================= */

let applications = [];

let nextApplicationId = 1;


/* =========================
   BEWERBUNG ABSENDEN
========================= */

app.post(
    "/api/applications",
    (req, res) => {

        if (!req.session.user) {

            return res
                .status(401)
                .json({

                    error:
                        "Du musst dich mit Discord anmelden."

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


        if (
            !icName ||
            !oocAge
        ) {

            return res
                .status(400)
                .json({

                    error:
                        "IC-Name und OOC-Alter müssen ausgefüllt werden."

                });

        }


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


        res.json({

            success:
                true,

            application:
                application

        });

    }
);


/* =========================
   ADMIN PRÜFUNG
========================= */

function isAdmin(req) {

    return (
        req.session.user &&
        req.session.user.isBruderschaft === true
    );

}


/* =========================
   ADMIN CHECK
========================= */

app.get(
    "/api/admin/check",
    (req, res) => {

        res.json({

            admin:
                isAdmin(req),

            codeRequired:
                ADMIN_CODE

        });

    }
);


/* =========================
   BEWERBUNGEN ANZEIGEN
========================= */

app.get(
    "/api/applications",
    (req, res) => {

        if (!isAdmin(req)) {

            return res
                .status(403)
                .json({

                    error:
                        "Keine Bruderschaft-Berechtigung."

                });

        }


        res.json(
            applications
        );

    }
);


/* =========================
   BEWERBUNG BEARBEITEN
========================= */

app.put(
    "/api/applications/:id",
    (req, res) => {

        if (!isAdmin(req)) {

            return res
                .status(403)
                .json({

                    error:
                        "Keine Bruderschaft-Berechtigung."

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
            req.body.icName !==
            undefined
        ) {

            application.icName =
                String(
                    req.body.icName
                ).trim();

        }


        if (
            req.body.oocAge !==
            undefined
        ) {

            application.oocAge =
                String(
                    req.body.oocAge
                ).trim();

        }


        if (
            req.body.status !==
            undefined
        ) {

            const allowedStatuses = [

                "offen",

                "angenommen",

                "abgelehnt"

            ];


            if (
                allowedStatuses.includes(
                    req.body.status
                )
            ) {

                application.status =
                    req.body.status;

            }

        }


        res.json({

            success:
                true,

            application:
                application

        });

    }
);


/* =========================
   BEWERBUNG LÖSCHEN
========================= */

app.delete(
    "/api/applications/:id",
    (req, res) => {

        if (!isAdmin(req)) {

            return res
                .status(403)
                .json({

                    error:
                        "Keine Bruderschaft-Berechtigung."

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


/* =========================
   SERVER STARTEN
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Shadow Ranch läuft auf Port ${PORT}`
        );

    }
);
