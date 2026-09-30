require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, 'data', 'applications.json');
const GALLERY_DIR = path.join(__dirname, 'public', 'assets', 'gallery');
fs.mkdirSync(GALLERY_DIR, {recursive:true});
fs.mkdirSync(path.dirname(DATA_FILE), {recursive:true});
if(!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

app.use(express.json({limit:'50kb'}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE_ME',
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*24*7}
}));
app.use(express.static(path.join(__dirname,'public')));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, GALLERY_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`);
    }
  }),
  limits: {fileSize: 8 * 1024 * 1024},
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.webp','.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

function readApps(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch { return []; }
}
function writeApps(apps){ fs.writeFileSync(DATA_FILE, JSON.stringify(apps,null,2)); }
function requireLogin(req,res,next){ if(!req.session.user) return res.status(401).json({error:'Bitte mit Discord anmelden.'}); next(); }
function requireBruderschaft(req,res,next){ if(!req.session.user?.isBruderschaft) return res.status(403).json({error:'Nur die Bruderschaft hat Zugriff.'}); next(); }
function requireAdmin(req,res,next){ if(!req.session.admin) return res.status(401).json({error:'Webseiten-Code erforderlich.'}); next(); }

app.get('/auth/discord',(req,res)=>{
  const params=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID||'',redirect_uri:process.env.DISCORD_REDIRECT_URI||'',response_type:'code',scope:'identify guilds.members.read'});
  if(!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) return res.status(500).send('Discord OAuth ist noch nicht konfiguriert. Trage die Werte in .env ein.');
  res.redirect('https://discord.com/oauth2/authorize?'+params.toString());
});

app.get('/auth/discord/callback',async(req,res)=>{
  try{
    const code=req.query.code;
    if(!code) return res.status(400).send('Discord-Anmeldung abgebrochen.');
    const tokenRes=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:process.env.DISCORD_REDIRECT_URI})});
    const token=await tokenRes.json();
    if(!token.access_token) return res.status(400).send('Discord-Token konnte nicht abgerufen werden.');
    const userRes=await fetch('https://discord.com/api/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`}});
    const user=await userRes.json();
    let roles=[];
    if(process.env.DISCORD_GUILD_ID){
      const memberRes=await fetch(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,{headers:{Authorization:`Bearer ${token.access_token}`}});
      if(memberRes.ok){ const member=await memberRes.json(); roles=member.roles||[]; }
    }
    req.session.user={id:user.id,username:user.global_name||user.username,avatar:user.avatar||null,roles,isBurger:roles.includes(process.env.BURGER_ROLE_ID),isBruderschaft:roles.includes(process.env.BRUDERSCHAFT_ROLE_ID)};
    res.redirect('/#start');
  }catch(err){ console.error(err); res.status(500).send('Discord-Anmeldung fehlgeschlagen.'); }
});
app.get('/auth/logout',(req,res)=>req.session.destroy(()=>res.redirect('/#start')));

app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));
app.post('/api/applications',requireLogin,(req,res)=>{
  const name=String(req.body.name||'').trim(), age=String(req.body.age||'').trim();
  if(!name || !age) return res.status(400).json({error:'Bitte alle Pflichtfelder ausfüllen.'});
  const apps=readApps();
  const application={id:crypto.randomUUID(),name,age,status:'Offen',date:new Date().toLocaleString('de-DE'),discordId:req.session.user.id,discordUsername:req.session.user.username};
  apps.unshift(application); writeApps(apps); res.status(201).json({application});
});

app.post('/api/admin/login',(req,res)=>{
  if(String(req.body.code||'')!==String(process.env.ADMIN_CODE||'7260')) return res.status(401).json({error:'Falscher Admin-Code.'});
  req.session.admin=true; res.json({ok:true});
});
app.post('/api/admin/logout',(req,res)=>{req.session.admin=false;res.json({ok:true});});
app.get('/api/admin/check',requireAdmin,(req,res)=>res.json({ok:true}));
app.get('/api/applications',requireLogin,requireAdmin,(req,res)=>res.json({applications:readApps()}));

app.get('/api/gallery', (_req,res) => {
  const files = fs.readdirSync(GALLERY_DIR)
    .filter(name => ['.jpg','.jpeg','.png','.webp','.gif'].includes(path.extname(name).toLowerCase()))
    .sort();
  res.json({images: files.map(name => `/assets/gallery/${encodeURIComponent(name)}`)});
});

app.post('/api/gallery', requireAdmin, upload.single('image'), (req,res) => {
  if(!req.file) return res.status(400).json({error:'Bitte eine Bilddatei (JPG, PNG, WEBP oder GIF) auswählen.'});
  res.status(201).json({ok:true, image:`/assets/gallery/${encodeURIComponent(req.file.filename)}`});
});

app.delete('/api/gallery/:name', requireAdmin, (req,res) => {
  const name = path.basename(req.params.name);
  const file = path.join(GALLERY_DIR, name);
  if(!fs.existsSync(file)) return res.status(404).json({error:'Bild nicht gefunden.'});
  fs.unlinkSync(file);
  res.json({ok:true});
});
app.patch('/api/applications/:id',requireLogin,requireAdmin,(req,res)=>{
  const status=String(req.body.status||'');
  if(!['Offen','Angenommen','Abgelehnt'].includes(status)) return res.status(400).json({error:'Ungültiger Status.'});
  const apps=readApps(); const idx=apps.findIndex(a=>a.id===req.params.id); if(idx<0) return res.status(404).json({error:'Bewerbung nicht gefunden.'});
  apps[idx].status=status; apps[idx].updatedAt=new Date().toISOString(); writeApps(apps); res.json({application:apps[idx]});
});
app.delete('/api/applications/:id',requireLogin,requireAdmin,(req,res)=>{
  const apps=readApps(); const next=apps.filter(a=>a.id!==req.params.id); if(next.length===apps.length) return res.status(404).json({error:'Bewerbung nicht gefunden.'});
  writeApps(next); res.json({ok:true});
});

app.listen(PORT,()=>console.log(`Shadow Ranch läuft auf http://localhost:${PORT}`));
