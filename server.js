require('dotenv').config();

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, 'data', 'applications.json');

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
}

app.use(express.json({ limit: '50kb' }));

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'shadow-ranch-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   BEWERBUNGEN
========================= */

function readApps() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function writeApps(apps) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2));
}

/* =========================
   DISCORD LOGIN
   JEDE ROLLE ERLAUBT
========================= */

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            error: 'Bitte zuerst mit Discord anmelden.'
        });
    }

    next();
}

/* =========================
   ADMIN / WEBSEITENVERWALTUNG
========================= */

function requireAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({
            error: 'Webseiten-Code erforderlich.'
        });
    }

    next();
}

/* =========================
   DISCORD ANMELDUNG
========================= */

app.get('/auth/discord', (req, res) => {

    if (
        !process.env.DISCORD_CLIENT_ID ||
        !process.env.DISCORD_CLIENT_SECRET ||
        !process.env.DISCORD_REDIRECT_URI
    ) {
        return res.status(500).send(
            'Discord OAuth ist noch nicht eingerichtet. Bitte .env prüfen.'
        );
    }

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds.members.read'
    });

    res.redirect(
        'https://discord.com/oauth2/authorize?' +
        params.toString()
    );
});

/* =========================
   DISCORD CALLBACK
========================= */

app.get('/auth/discord/callback', async (req, res) => {

    try {

        const code = req.query.code;

        if (!code) {
            return res.status(400).send(
                'Discord-Anmeldung abgebrochen.'
            );
        }

        const tokenRes = await fetch(
            'https://discord.com/api/oauth2/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id:
                        process.env.DISCORD_CLIENT_ID,

                    client_secret:
                        process.env.DISCORD_CLIENT_SECRET,

                    grant_type:
                        'authorization_code',

                    code,

                    redirect_uri:
                        process.env.DISCORD_REDIRECT_URI
                })
            }
        );

        const token = await tokenRes.json();

        if (!token.access_token) {
            console.error(token);

            return res.status(400).send(
                'Discord-Token konnte nicht abgerufen werden.'
            );
        }

        /* Discord Benutzer */

        const userRes = await fetch(
            'https://discord.com/api/users/@me',
            {
                headers: {
                    Authorization:
                        `Bearer ${token.access_token}`
                }
            }
        );

        const user = await userRes.json();

        /* Rollen auslesen */

        let roles = [];

        if (process.env.DISCORD_GUILD_ID) {

            const memberRes = await fetch(
                `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token.access_token}`
                    }
                }
            );

            if (memberRes.ok) {

                const member =
                    await memberRes.json();

                roles = member.roles || [];
            }
        }

        /*
         * WICHTIG:
         * Keine Rollenprüfung mehr.
         * Jeder Discord-Benutzer darf sich anmelden.
         */

        req.session.user = {
            id: user.id,

            username:
                user.global_name ||
                user.username,

            avatar:
                user.avatar || null,

            roles
        };

        res.redirect('/#start');

    } catch (error) {

        console.error(error);

        res.status(500).send(
            'Discord-Anmeldung fehlgeschlagen.'
        );
    }
});

/* =========================
   LOGOUT
========================= */

app.get('/auth/logout', (req, res) => {

    req.session.destroy(() => {
        res.redirect('/#start');
    });

});

/* =========================
   BENUTZER
========================= */

app.get('/api/me', (req, res) => {

    res.json({
        user: req.session.user || null
    });

});

/* =========================
   BEWERBUNG ABSENDEN
========================= */

app.post('/api/applications', requireLogin, (req, res) => {

    const name =
        String(req.body.name || '').trim();

    const age =
        String(req.body.age || '').trim();

    if (!name || !age) {

        return res.status(400).json({
            error:
                'Bitte alle Pflichtfelder ausfüllen.'
        });

    }

    const apps = readApps();

    const application = {

        id: crypto.randomUUID(),

        name,

        age,

        status: 'Offen',

        date:
            new Date().toLocaleString('de-DE'),

        discordId:
            req.session.user.id,

        discordUsername:
            req.session.user.username

    };

    apps.unshift(application);

    writeApps(apps);

    res.status(201).json({
        application
    });

});

/* =========================
   WEBSEITENVERWALTUNG
   CODE: 7260
========================= */

app.post('/api/admin/login', requireLogin, (req, res) => {

    const code =
        String(req.body.code || '').trim();

    const adminCode =
        String(
            process.env.ADMIN_CODE || '7260'
        ).trim();

    if (code !== adminCode) {

        return res.status(401).json({
            error: 'Falscher Code.'
        });

    }

    req.session.admin = true;

    res.json({
        ok: true,
        message:
            'Webseitenverwaltung geöffnet.'
    });

});

/* =========================
   WEBSEITENVERWALTUNG ABMELDEN
========================= */

app.post('/api/admin/logout', (req, res) => {

    req.session.admin = false;

    res.json({
        ok: true
    });

});

/* =========================
   ADMIN CHECK
========================= */

app.get(
    '/api/admin/check',
    requireLogin,
    requireAdmin,
    (req, res) => {

        res.json({
            ok: true
        });

    }
);

/* =========================
   BEWERBUNGEN ANZEIGEN
========================= */

app.get(
    '/api/applications',
    requireLogin,
    requireAdmin,
    (req, res) => {

        res.json({
            applications:
                readApps()
        });

    }
);

/* =========================
   BEWERBUNG ANNEHMEN / ABLEHNEN
========================= */

app.patch(
    '/api/applications/:id',
    requireLogin,
    requireAdmin,
    (req, res) => {

        const status =
            String(
                req.body.status || ''
            );

        if (
            ![
                'Offen',
                'Angenommen',
                'Abgelehnt'
            ].includes(status)
        ) {

            return res.status(400).json({
                error:
                    'Ungültiger Status.'
            });

        }

        const apps = readApps();

        const index =
            apps.findIndex(
                app =>
                    app.id === req.params.id
            );

        if (index < 0) {

            return res.status(404).json({
                error:
                    'Bewerbung nicht gefunden.'
            });

        }

        apps[index].status = status;

        apps[index].updatedAt =
            new Date().toISOString();

        writeApps(apps);

        res.json({
            application:
                apps[index]
        });

    }
);

/* =========================
   BEWERBUNG LÖSCHEN
========================= */

app.delete(
    '/api/applications/:id',
    requireLogin,
    requireAdmin,
    (req, res) => {

        const apps = readApps();

        const next =
            apps.filter(
                app =>
                    app.id !== req.params.id
            );

        if (
            next.length ===
            apps.length
        ) {

            return res.status(404).json({
                error:
                    'Bewerbung nicht gefunden.'
            });

        }

        writeApps(next);

        res.json({
            ok: true
        });

    }
);

/* =========================
   SERVER START
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Shadow Ranch läuft auf Port ${PORT}`
        );

        console.log(
            'Webseitenverwaltung Code: 7260'
        );

    }
);
