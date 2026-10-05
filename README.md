# 🥬 FreshSabji - Online Vegetable Store

Login/Register, cart, order placement, **WhatsApp notification on every order**, customer order history aur admin panel.

## Setup (5 minute)

1. Node.js 18+ install karein.
2. Is folder mein terminal kholein:
   ```bash
   npm install
   cp .env.example .env      # Windows: copy .env.example .env
   ```
3. `.env` file kholkar **JWT_SECRET**, **ADMIN_PHONE**, **ADMIN_PASSWORD** badlein.
4. Server chalayein:
   ```bash
   npm start
   ```
5. Browser mein kholein: http://localhost:3000

## Admin
- `.env` wale ADMIN_PHONE / ADMIN_PASSWORD se login karein (default: `9999999999` / `admin12345` - **badal dein!**).
- Admin panel mein: naye orders, status change (customer ko WhatsApp jata hai), products add/price/stock/delete.

## WhatsApp notification kaise on karein (Twilio)
Bina setup ke bhi app chalta hai: message console mein print hota hai (test mode).

Asli WhatsApp ke liye:
1. https://www.twilio.com par account banayein -> **Messaging > Try it out > Send a WhatsApp message**.
2. `.env` mein `TWILIO_ACCOUNT_SID` aur `TWILIO_AUTH_TOKEN` daalein.
3. **Sandbox mein:** har customer ko pehle sandbox number par `join <your-code>` WhatsApp karna padta hai (sirf testing ke liye).
4. **Live ke liye:** Twilio mein apna WhatsApp Business number approve karwayein aur `TWILIO_WHATSAPP_FROM=whatsapp:+91XXXXXXXXXX` set karein.
5. `OWNER_WHATSAPP` mein apna number daalein - har naye order ki copy aapko bhi milegi.

## Online hosting
Render / Railway / VPS par deploy karein (`npm start`). HTTPS lagayein aur `.env` ki values hosting dashboard mein set karein. SQLite file (`store.db`) ko persistent disk par rakhein.

## Folder structure
```
server.js      API + auth + orders
db.js          SQLite tables + sample products
whatsapp.js    WhatsApp (Twilio) messages
public/        Website (index, login, orders, admin)
```
