# Shadow Ranch Website v2

Die Website enthält jetzt:
- Discord OAuth2-Anmeldung
- Bürger-Zugriff nach Discord-Anmeldung
- Bruderschaft-Zugriff über eine konfigurierbare Discord-Rolle
- Admin-Code `1583` (serverseitig, per `.env` änderbar)
- Bewerbungen mit dauerhaftem JSON-Speicher
- Admin-Panel zum Annehmen, Ablehnen, Zurücksetzen und Löschen

## Einrichtung

1. `npm install`
2. `.env.example` nach `.env` kopieren.
3. Discord Developer Portal: OAuth2 Redirect URI passend zu `DISCORD_REDIRECT_URI` eintragen.
4. `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID` und `BRUDERSCHAFT_ROLE_ID` eintragen.
5. `SESSION_SECRET` durch ein langes zufälliges Geheimnis ersetzen.
6. `npm start`

Wichtig: Für echte Online-Speicherung muss die Website auf einem Node.js-Server mit dauerhaftem Speicher betrieben werden. GitHub Pages allein führt den Server nicht aus.
