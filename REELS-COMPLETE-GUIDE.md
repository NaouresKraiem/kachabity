# 🎬 Complete Guide: TikTok-Style Video Reels

## ✅ What I Created:

### 1. **New Database Table** - `reels`
- Stores vertical video content
- Separate from sale banners/promotions
- Fields: title, description, username, thumbnail, video, sort order

### 2. **Admin Panel** - `/admin/reels`
- Upload video files (.mp4, .mov)
- Upload thumbnails (9:16 vertical)
- Add title, description, username
- Sort order and active/inactive status

### 3. **Frontend Component** - Fullscreen Vertical Scrolling
- Like TikTok/Instagram Reels
- Scroll up/down with mouse or swipe
- Auto-play videos
- Beautiful overlay UI

### 4. **API** - Full CRUD Operations
- GET, POST, PUT, DELETE
- Manages all reel data

---

## 🚀 Quick Start (3 Steps):

### Step 1: Install Swiper
```bash
cd /Users/takiacademy/Downloads/landing/landing
npm install swiper
```

### Step 2: Setup Database
1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy/paste from: `scripts/create-reels-table.sql`
4. Click **Run**

### Step 3: Restart Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

## 📱 How to Use:

### Add Your First Reel:

1. **Go to Admin:**
   ```
   http://localhost:3000/admin/reels
   ```

2. **Click "Create Reel"**

3. **Upload Files:**
   - **Thumbnail**: 1080x1920px (9:16 vertical)
   - **Video**: MP4 format, under 100MB

4. **Fill Details:**
   ```
   Title: مقدمة عن تكي أكاديمي
   Description: تعرف على منصتنا التعليمية 🔥
   Username: @takiacademy
   Sort Order: 1
   Active: ✅
   ```

5. **Click Save**

6. **Add 2-3 more reels** (for best effect)

---

## 🎯 View the Reels:

1. Go to homepage: `http://localhost:3000`
2. Scroll down past the Sale Banner
3. **See fullscreen vertical video reels!**

### Controls:
- **Scroll/Swipe**: Navigate up/down
- **Click play button**: Pause/resume
- **Click video**: Pause/resume
- **Dots on right**: Jump to specific reel

---

## 📋 Features:

### ✨ User Experience:
- Fullscreen vertical layout
- Smooth scrolling/swiping
- Auto-play on view
- Auto-pause when scrolling away
- Video loops automatically
- Gradient overlay for readability

### 🎨 Visual Design:
- Title and description overlay
- Username display (@takiacademy)
- Play/Pause button
- Share button
- Pagination dots
- Top logo badge
- Professional gradient effects

---

## 📁 What Was Created:

```
landing/
├── app/
│   ├── api/
│   │   └── reels/
│   │       └── route.ts          ← NEW API
│   ├── admin/
│   │   ├── layout.tsx            ← UPDATED (added menu)
│   │   └── reels/
│   │       └── page.tsx          ← NEW Admin page
│   └── [locale]/
│       └── page.tsx               ← UPDATED (added Reels)
├── components/
│   └── sections/
│       ├── Reels.tsx              ← NEW Component
│       └── SocialContent.tsx      ← Unchanged (still works)
└── scripts/
    └── create-reels-table.sql     ← NEW Database script
```

---

## 🎬 Video Specifications:

### Thumbnail:
- **Aspect Ratio**: 9:16 (vertical)
- **Resolution**: 1080x1920px recommended
- **Format**: JPG, PNG
- **Size**: Under 5MB

### Video:
- **Aspect Ratio**: 9:16 (vertical)
- **Resolution**: 1080x1920px or 720x1280px
- **Format**: MP4 (recommended), MOV
- **Size**: Under 100MB
- **Duration**: 15-60 seconds recommended

---

## 💡 Pro Tips:

### Content Ideas:
1. **Platform Introduction** - Quick tour
2. **Feature Highlights** - Show key features
3. **Student Success Stories** - Before/after
4. **Teacher Introductions** - Meet the team
5. **Course Previews** - Sample lessons
6. **Tips & Tricks** - Quick tutorials
7. **Behind the Scenes** - Office/team
8. **Testimonials** - Happy students

### Best Practices:
- ✅ Keep videos under 60 seconds
- ✅ Use clear, vertical recordings
- ✅ Add engaging titles
- ✅ Use emojis in descriptions
- ✅ Maintain consistent branding
- ✅ Update regularly (weekly recommended)

---

## 🆘 Troubleshooting:

### Error: Cannot find module 'swiper'
```bash
npm install swiper
# Restart server
```

### Reels not showing on homepage:
- Check: Database table created? ✅
- Check: Swiper installed? ✅
- Check: At least 1 reel marked as active? ✅
- Check: Server restarted after install? ✅

### Videos not uploading:
- Check file size (under 100MB)
- Check format (MP4 works best)
- Check Supabase storage settings

### Videos not playing:
- Check browser (Chrome/Safari work best)
- Check video format
- Check browser console for errors
- Try different video file

---

## 📊 Difference from SocialContent:

| Feature | SocialContent | Reels |
|---------|--------------|-------|
| Layout | Horizontal slider | Fullscreen vertical |
| Videos | YouTube embeds | Direct video files |
| Scroll | Left/Right | Up/Down |
| Auto-play | On click | Automatic |
| Use Case | Showcase content | Engaging stories |
| Database | promotions table | reels table |

**Both can coexist!** They serve different purposes:
- **SocialContent**: Blue card slider for YouTube videos
- **Reels**: TikTok-style fullscreen vertical videos

---

## 🎉 You're Done!

Your site now has:
- ✅ Professional video reels section
- ✅ Easy admin management
- ✅ TikTok/Instagram-style experience
- ✅ Auto-playing vertical videos
- ✅ Beautiful UI with overlays

### Next Steps:
1. Install Swiper: `npm install swiper`
2. Run SQL script in Supabase
3. Upload your first video in `/admin/reels`
4. Watch it live on your homepage!

Happy creating! 🚀



