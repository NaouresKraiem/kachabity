# 🎬 Quick Guide: Add Multiple Videos to See Slider

You need **at least 3-4 videos** to see the slider effect!

---

## 🚀 Option 1: Add Demo Videos (SQL - Fast!)

### Run this in Supabase SQL Editor:

Copy and paste from: `scripts/add-demo-videos.sql`

This will add 5 sample videos with placeholder images and YouTube links.

**Result:** Slider works immediately! ✅

---

## 📝 Option 2: Add Videos Manually (Admin Panel)

### Go to: `/admin/sale-banners`

### Add Multiple Videos (Repeat 3-5 times):

#### **Video 1:**
```
Title: مقدمة عن تكي أكاديمي
Description: تعرف على منصتنا التعليمية
Badge: جديد
Thumbnail: [Upload any image]
URL: https://www.youtube.com/watch?v=YOUR_VIDEO_1
Dates: LEAVE EMPTY
Active: ✅
```

#### **Video 2:**
```
Title: كيفية التسجيل
Description: خطوات سهلة للتسجيل
Badge: شائع
Thumbnail: [Upload any image]
URL: https://www.youtube.com/watch?v=YOUR_VIDEO_2
Dates: LEAVE EMPTY
Active: ✅
```

#### **Video 3:**
```
Title: نظرة على الدورات
Description: استكشف دوراتنا التعليمية
Badge: (leave empty)
Thumbnail: [Upload any image]
URL: https://www.youtube.com/watch?v=YOUR_VIDEO_3
Dates: LEAVE EMPTY
Active: ✅
```

#### **Video 4:**
```
Title: قصص نجاح الطلاب
Description: شاهد تجارب طلابنا
Badge: ملهم
Thumbnail: [Upload any image]
URL: https://www.youtube.com/watch?v=YOUR_VIDEO_4
Dates: LEAVE EMPTY
Active: ✅
```

---

## 🎯 Important:

### ⚠️ Make Sure:
- ✅ Add **at least 3 videos** to see slider arrows
- ✅ All videos have **NO dates** (starts_at and ends_at are empty)
- ✅ All videos are marked **Active**
- ✅ Upload different thumbnail images

### 📸 Thumbnail Tips:
- Use 1280x720px images (16:9 ratio)
- Can use screenshots from your YouTube videos
- Or download from: https://unsplash.com

### 🎥 Video URL Tips:
Use your actual YouTube or Facebook video links:
```
YouTube: https://www.youtube.com/watch?v=xxxxx
Facebook: https://www.facebook.com/watch?v=xxxxx
```

---

## 🔍 Troubleshooting:

**Problem:** Slider not showing
- Check console: `console.log("posts", posts);`
- Should show array with multiple items
- If empty: Videos might have dates (remove them)
- If empty: Videos might not be Active (check checkbox)

**Problem:** Only 1 video shows
- You need at least 3-4 videos to see navigation arrows
- Add more videos through admin panel

**Problem:** Videos not loading
- Check Supabase connection
- Run RLS fix scripts first
- Make sure `link_url` column exists

---

## ✅ Success Checklist:

- [ ] Ran SQL script OR added videos through admin
- [ ] At least 3 videos added
- [ ] All videos have NO dates
- [ ] All videos marked as Active
- [ ] Thumbnails uploaded
- [ ] YouTube/Facebook links added
- [ ] Refresh homepage
- [ ] See slider with arrows! 🎉

---

Need help? The slider shows when you have 3+ videos without dates! 🚀



