require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// GRUNDEINSTELLUNGEN
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'shadow-ranch-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

// =========================
// ORDNER
// =========================

const publicPath = path.join(__dirname, 'public');
const dataPath = path.join(__dirname, 'data');
const galleryPath = path.join(publicPath, 'gallery');

if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

if (!fs.existsSync(galleryPath)) {
  fs.mkdirSync(galleryPath, { recursive: true });
}

// =========================
// STATISCHE WEBSEITE
// =========================

app.use(express.static(publicPath));

// =========================
// BILDER-UPLOAD
// =========================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, galleryPath);
  },

  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);
    const name =
      Date.now() +
      '-' +
      Math.random().toString(36).substring(2, 10) +
      extension;

    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// =========================
// STARTSEITE
// =========================

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// =========================
// LOGIN
// =========================

app.get('/login', (req, res) => {
  res.redirect('/auth/discord');
});

// =========================
// DISCORD LOGIN
// =========================

app.get('/auth/discord', (req, res) => {
  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.DISCORD_REDIRECT_URI
  ) {
    return res.status(500).send(
      'Discord-OAuth ist noch nicht konfiguriert. Bitte die Render-Umgebungsvariablen überprüfen.'
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read'
  });

  res.redirect(
    'https://discord.com/oauth2/authorize?' + params.toString()
  );
});

// =========================
// DISCORD CALLBACK
// =========================

app.get(
  ['/auth/discord/callback', '/callback'],
  async (req, res) => {
    try {
      const code = req.query.code;

      if (!code) {
        return res.status(400).send(
          'Discord-Anmeldung abgebrochen.'
        );
      }

      // Token holen
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

            code: code,

            redirect_uri:
              process.env.DISCORD_REDIRECT_URI
          })
        }
      );

      const token = await tokenRes.json();

      if (!token.access_token) {
        console.error(
          'Discord Token Fehler:',
          token
        );

        return res.status(400).send(
          'Discord-Token konnte nicht abgerufen werden.'
        );
      }

      // Discord Benutzer holen
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

      // =========================
      // DISCORD ROLLEN
      // =========================

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
          const member = await memberRes.json();

          roles = member.roles || [];
        }
      }

      // =========================
      // BENUTZER SPEICHERN
      // =========================

      req.session.user = {
        id: user.id,

        username:
          user.global_name ||
          user.username,

        avatar:
          user.avatar || null,

        roles: roles,

        isBurger:
          process.env.BURGER_ROLE_ID
            ? roles.includes(
                process.env.BURGER_ROLE_ID
              )
            : false,

        isBruderschaft:
          process.env.BRUDERSCHAFT_ROLE_ID
            ? roles.includes(
                process.env.BRUDERSCHAFT_ROLE_ID
              )
            : false
      };

      console.log(
        'Discord Login:',
        req.session.user.username
      );

      res.redirect('/#start');

    } catch (err) {
      console.error(
        'Discord Login Fehler:',
        err
      );

      res.status(500).send(
        'Discord-Anmeldung fehlgeschlagen.'
      );
    }
  }
);

// =========================
// AKTUELLER BENUTZER
// =========================

app.get('/api/me', (req, res) => {
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

// =========================
// LOGOUT
// =========================

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// =========================
// ADMIN-CODE
// =========================

app.post('/api/admin/login', (req, res) => {
  const { code } = req.body;

  const adminCode =
    process.env.ADMIN_CODE || '7260';

  if (String(code) === String(adminCode)) {
    req.session.admin = true;

    return res.json({
      success: true
    });
  }

  res.status(401).json({
    success: false,
    message: 'Falscher Admin-Code.'
  });
});

// =========================
// WEBSEITENVERWALTUNG-CODE
// =========================

app.post('/api/webverwaltung/login', (req, res) => {
  const { code } = req.body;

  const websiteCode =
    process.env.WEBSITE_CODE || '7260';

  if (String(code) === String(websiteCode)) {
    req.session.webverwaltung = true;

    return res.json({
      success: true
    });
  }

  res.status(401).json({
    success: false,
    message: 'Falscher Code.'
  });
});

// =========================
// GALERIE ANZEIGEN
// =========================

app.get('/api/gallery', (req, res) => {
  try {
    const files = fs
      .readdirSync(galleryPath)
      .filter(file => {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
      });

    const images = files.map(file => {
      return '/gallery/' + file;
    });

    res.json(images);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Galerie konnte nicht geladen werden.'
    });
  }
});

// =========================
// BILD HOCHLADEN
// =========================

app.post(
  '/api/gallery/upload',
  upload.single('image'),
  (req, res) => {

    if (
      !req.session.admin &&
      !req.session.webverwaltung
    ) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Kein Bild ausgewählt.'
      });
    }

    res.json({
      success: true,
      image: '/gallery/' + req.file.filename
    });
  }
);

// =========================
// BILD LÖSCHEN
// =========================

app.delete('/api/gallery/delete', (req, res) => {

  if (
    !req.session.admin &&
    !req.session.webverwaltung
  ) {
    return res.status(403).json({
      success: false,
      message: 'Keine Berechtigung.'
    });
  }

  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({
      success: false,
      message: 'Kein Bild angegeben.'
    });
  }

  const cleanFilename =
    path.basename(filename);

  const filePath =
    path.join(
      galleryPath,
      cleanFilename
    );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'Bild nicht gefunden.'
    });
  }

  try {
    fs.unlinkSync(filePath);

    res.json({
      success: true
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Bild konnte nicht gelöscht werden.'
    });
  }
});

// =========================
// SERVER START
// =========================

app.listen(PORT, () => {
  console.log(
    `Shadow Ranch Website läuft auf Port ${PORT}`
  );
});
