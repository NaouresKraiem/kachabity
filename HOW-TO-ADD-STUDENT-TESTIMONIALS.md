# 🎓 How to Add Student Video Testimonials

## 📸 What It Looks Like:

Beautiful blue-themed slider with:
- Student name in large white text
- Yellow score box (e.g., 18.07, 17.60)
- Student photo with YouTube play button
- "بكالوريا شعبة العلوم التقنية" subtitle
- Yellow button at bottom
- Logo badge at top left
- Navigation arrows to slide through videos

---

## 🚀 Quick Start (5 Steps):

### 1. Go to Admin Panel
**URL:** `/admin/sale-banners`

Click **"Create Banner"** button

### 2. Fill Form Fields

| Field | What to Enter | Example |
|-------|---------------|---------|
| **Title** | Student's full name | `نور السمين` or `محمد عزيز عمري` |
| **Subtitle** | Top bar text (or leave empty) | `حفل التميز 2024` |
| **Badge Text** | Score/Grade | `18.07` or `17.60` |
| **Student Photo** | Upload portrait photo | 400x500px recommended |
| **YouTube URL** | Full video link | `https://www.youtube.com/watch?v=xxxxx` |
| **Discount %** | Leave as 0 | `0` |
| **Duration** | ⚠️ **LEAVE EMPTY** | No dates |
| **Active** | Check this | ✅ |

### 3. Upload Photo
- Click "Upload Photo"
- Select student's portrait photo
- Face should be clearly visible
- Good lighting preferred

### 4. Add YouTube Link
Paste the full YouTube URL:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
or short format:
```
https://youtu.be/dQw4w9WgXcQ
```

### 5. Save
Click **"Save"** button - Done! 🎉

---

## 📋 Complete Example:

```
✅ Title (Student Name): أنيس السلاسي
📝 Subtitle: (leave empty)
🏆 Badge Text (Score): 18.07
📷 Student Photo: [Upload portrait]
🎥 YouTube URL: https://www.youtube.com/watch?v=xxxxx
💰 Discount %: 0
📅 Start Date: (empty)
📅 End Date: (empty)
✅ Active: Yes
```

Click Save → Video appears in slider immediately!

---

## ⚠️ Important Rules:

### ✅ DO:
- Use clear, high-quality student photos
- Add real YouTube video links
- Use actual scores in Badge Text field
- Keep dates empty (no start/end date)
- Check "Active" checkbox

### ❌ DON'T:
- Don't add start or end dates
- Don't use low-quality photos
- Don't forget the YouTube link
- Don't use discount percentage field
- Don't forget to click Active

---

## 🎨 Design Details:

### Colors:
- **Blue gradient**: #1e88c4 → #0d5a8a
- **Yellow box**: #fbbf24
- **Text**: White
- **Button**: Yellow with blue text

### Card Structure:
```
┌─────────────────────────────┐
│ 🏷️ Logo                     │
├─────────────────────────────┤
│ Top Bar: Conference Text    │
├─────────────────────────────┤
│                             │
│  Student Name    [Photo]    │
│                  [Play▶️]    │
│     18.07                   │
│  بكالوريا...                │
│                             │
├─────────────────────────────┤
│  [Yellow Button]            │
└─────────────────────────────┘
```

---

## 🎬 What Happens:

1. **Slider shows 3 videos** at once (desktop)
2. **User clicks photo or button** → Video opens in modal
3. **YouTube player** auto-plays the video
4. **Close button** exits the video
5. **Navigation arrows** to see more testimonials

---

## 📱 Where to Find It:

### Admin:
`/admin/sale-banners` → Create/manage testimonials

### Frontend:
Homepage → "آراء و تجارب تلامذتنا" section

### When It Shows:
- Automatically displays when you have content WITHOUT dates
- If you add promotions WITH dates, it switches to countdown banner

---

## 🆘 Troubleshooting:

**Problem:** Video testimonials not showing
- ✅ Check: Are dates empty?
- ✅ Check: Is Active checkbox checked?
- ✅ Check: Is YouTube URL valid?

**Problem:** Video won't play
- ✅ Check: YouTube URL format correct?
- ✅ Check: Video is public (not private)?
- ✅ Try: Different browser

**Problem:** Photo looks stretched
- ✅ Use: Portrait orientation (vertical)
- ✅ Size: 400x500px works best
- ✅ Crop: Center on face

---

## 🎯 Pro Tips:

1. **Add multiple students** → Creates slider effect
2. **Use high scores** → Shows success stories
3. **Clear photos** → Professional appearance
4. **Update regularly** → Keep content fresh
5. **Test links** → Make sure videos work

---

## 📞 Need Help?

Check these files:
- `/components/sections/SocialContent.tsx` - Frontend component
- `/app/admin/sale-banners/page.tsx` - Admin interface
- This file - Instructions

---

Ready to showcase your students' success! 🎓✨



