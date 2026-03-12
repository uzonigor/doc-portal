✅ RENDER.COM DEPLOYMENT VODIČ

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║          GO4 - DOC Portal na Render.com                         ║
║          (Besplatan hosting za Frontend + Backend)              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

## STEP 1: PRIPREMI FAJLOVE

Trebaju ti SAMO ovi fajlovi (preostali su za development):

OBAVEZNO:
├── index.html                    ← Glavna stranica
├── forma-potvrda.html           ← Forme
├── forma-zahtev.html
├── forma-ugovor.html
│
├── server.js                     ← Backend
├── package.json                  ← Zavisnosti
├── .gitignore                    ← Git exclusions
│
├── routes/
│   ├── forms.js
│   ├── upload.js
│   └── submissions.js
│
└── controllers/
    ├── formController.js
    ├── uploadController.js
    └── submissionController.js

NE TREBAJU:
├── .env          ← Kreiraj novi na Render-u (env variables)
├── node_modules/ ← Auto se instalira
├── uploads/      ← Auto se pravi
└── Ostali .md fajlovi (samo za info)

═══════════════════════════════════════════════════════════════════

## STEP 2: PUSHUJ NA GITHUB

1. Kreiraj GitHub repo:
   - Idi na https://github.com/new
   - Kreiraj "doc-portal"
   
2. Init Git lokalno:
   ```bash
   git init
   git add .gitignore package.json server.js routes/ controllers/ index.html forma-*.html
   git commit -m "Initial commit: GO4 Doc Portal"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/doc-portal.git
   git push -u origin main
   ```

3. ✅ GitHub repo je spreman

═══════════════════════════════════════════════════════════════════

## STEP 3: KREIRAJ RENDER ACCOUNT

1. Idi na https://render.com
2. Klikni "Sign up"
3. Odaberi "GitHub" (ili email)
4. Dozvoli Render.com pristup GitHub-u

═══════════════════════════════════════════════════════════════════

## STEP 4: KREIRAJ WEB SERVICE NA RENDER-U

1. Idi na https://dashboard.render.com
2. Klikni "New +" → "Web Service"
3. Odaberi GitHub repo ("doc-portal")
4. Popuni:

   **Name:** doc-portal
   **Environment:** Node
   **Build Command:** npm install
   **Start Command:** npm start
   **Instance Type:** Free

5. Klikni "Create Web Service"
6. 🚀 Render automatski deployuje!

═══════════════════════════════════════════════════════════════════

## STEP 5: POSTAVI ENVIRONMENT VARIABLES

Na Render dashboard-u:

1. Idi u Settings → "Environment"
2. Dodaj:

   ```
   PORT=10000
   NODE_ENV=production
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   EMAIL_TO_OPERATOR=operator@eds.rs
   MAX_FILE_SIZE=10485760
   ```

3. Klikni "Save"
4. Render automatski restartuje server sa novim varijablama

═══════════════════════════════════════════════════════════════════

## STEP 6: TESTIRAJ

1. Čekaj ~5 minuta za deploy
2. Render će ti dati URL: `https://doc-portal-xxxx.onrender.com`
3. Testiraj:

   ```bash
   curl https://doc-portal-xxxx.onrender.com/api/health
   ```

4. Trebao bi odgovor:
   ```json
   {
     "status": "OK",
     "message": "Backend radi!",
     "timestamp": "2024-..."
   }
   ```

═══════════════════════════════════════════════════════════════════

## RENDER FEATURES

✅ Besplatan hosting
✅ Auto deployment na svaki push
✅ SSL (HTTPS) uključen
✅ 0.5GB storage za uploads
✅ Papusi ako je idle > 15 min (FREE plan)
✅ Besplatan PostgreSQL/MySQL
✅ Cron jobovi

⚠️ LIMITACIJE FREE PLAN-A:
- Papuša (spin-down) posle 15 min inaktivnosti
- Prvi request je spora (cold start)
- Max 0.5GB RAM
- 0.5GB storage

═══════════════════════════════════════════════════════════════════

## ZA PRODUKCIJU - UPGRADE

Ako trebaju:
- Stalni server (bez papuše)
- Više RAM-a
- Backup

Klikni na Render dashboard → Settings → Upgrade (od $7/mesec)

═══════════════════════════════════════════════════════════════════

## PROBLEMI I REŠENJA

### Problem: "Build failed"
Rešenje: Proverite package.json - trebaju sve zavisnosti

### Problem: "Port error"
Rešenje: Render automatski dodeluje PORT kao env variable (koristi process.env.PORT)

### Problem: "Uploads nisu čuvani"
Rešenje: Render čuva uploadse u RAM-u privremeno, ali se gube na redeploy-u
Rešenje: Koristi Render Disk ili S3 bucket (paid)

### Problem: "Email ne radi"
Rešenje: Proverite Gmail App Password (ne obična lozinka!)

═══════════════════════════════════════════════════════════════════

## ZA BAZU PODATAKA (Sledeće)

Render nudi besplatnu PostgreSQL:

1. Dashboard → "New +" → "PostgreSQL"
2. Kopiraj CONNECTION STRING
3. Stavi u .env kao DB_URL
4. Koristi sa Prisma ili Sequelize

═══════════════════════════════════════════════════════════════════

## CHECKOUT URL

Após deploy-a, Render će ti dati:

🌐 https://doc-portal-xxxx.onrender.com

To je tvoja produkcijska URL! 🎉

═══════════════════════════════════════════════════════════════════

## GIT WORKFLOW ZA BUDUĆE

Svaki put kad meniš kod:

```bash
git add .
git commit -m "Feature: Dodaj email notifikacije"
git push origin main
```

Render AUTOMATSKI deployuje! 🚀

═══════════════════════════════════════════════════════════════════

📧 Ako ima problema, kontaktiraj Render support:
   https://render.com/docs

═══════════════════════════════════════════════════════════════════
