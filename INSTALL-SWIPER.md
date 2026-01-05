# 📦 Install Swiper for Reels

## 🚀 Quick Installation:

Run this command in your terminal:

```bash
npm install swiper
```

OR with yarn:

```bash
yarn add swiper
```

---

## ✅ What Was Created:

### 1. **Database Table** (`scripts/create-reels-table.sql`)
- Stores vertical video reels
- Fields: title, description, username, thumbnail_url, video_url, sort_order, active

### 2. **API Route** (`app/api/reels/route.ts`)
- GET, POST, PUT, DELETE endpoints
- Manages reels data

### 3. **Admin Page** (`app/admin/reels/page.tsx`)
- Upload thumbnails and videos
- Manage reels content
- Set title, description, username
- Sort order and active status

### 4. **Reels Component** (`components/sections/Reels.tsx`)
- TikTok/Instagram Reels style
- Vertical scrolling
- Auto-play videos
- Beautiful overlay UI

### 5. **Updated Files**
- `app/admin/layout.tsx` - Added "Video Reels" menu
- `app/[locale]/page.tsx` - Added Reels section

---

## 📋 Setup Steps:

### Step 1: Install Swiper
```bash
cd /Users/takiacademy/Downloads/landing/landing
npm install swiper
```

### Step 2: Run SQL Script
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and run: `scripts/create-reels-table.sql`

### Step 3: Test Admin Panel
1. Go to: `http://localhost:3000/admin/reels`
2. Click "Create Reel"
3. Upload:
   - Thumbnail (9:16 vertical image)
   - Video file (MP4)
   - Title & Description
4. Click Save

### Step 4: View on Homepage
1. Go to: `http://localhost:3000`
2. Scroll down past Sale Banner
3. See fullscreen vertical video reels!

---

## 🎬 Features:

### Vertical Scrolling
- Scroll/swipe up and down
- Like TikTok/Instagram Reels
- Mousewheel support

### Auto-Play
- Videos play automatically
- Pause when scrolling away
- Loop continuously

### Beautiful UI
- Gradient overlay
- Title and description
- Username display
- Play/Pause button
- Share button
- Pagination dots

---

## 📁 File Structure:

```
landing/
├── app/
│   ├── api/
│   │   └── reels/
│   │       └── route.ts          ← API
│   └── admin/
│       └── reels/
│           └── page.tsx           ← Admin page
├── components/
│   └── sections/
│       └── Reels.tsx              ← Frontend component
└── scripts/
    └── create-reels-table.sql     ← Database setup
```

---

## 🎯 Usage:

### Add Reels:
1. Admin → Video Reels
2. Upload vertical videos (9:16 ratio)
3. Add title/description
4. Mark as active

### View Reels:
- Homepage below Sale Banner
- Fullscreen vertical scrolling
- Auto-plays videos

---

## 🆘 Troubleshooting:

**Error: Cannot find module 'swiper'**
- Run: `npm install swiper`
- Restart dev server

**Reels not showing:**
- Check: Database table created?
- Check: Videos marked as active?
- Check: Videos uploaded properly?

**Videos not playing:**
- Check video format (MP4 works best)
- Check file size (under 100MB)
- Check browser console for errors

---

Done! You now have TikTok-style reels on your site! 🎉



