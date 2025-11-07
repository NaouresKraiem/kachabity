# Supabase Storage Setup for Product Images

## Step 1: Create Storage Bucket in Supabase

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Go to Storage**
   - Click on "Storage" in the left sidebar
   - Click "Create a new bucket"

3. **Create the Bucket**
   - **Bucket name**: `product-images`
   - **Public bucket**: ✅ Yes (Enable)
   - **File size limit**: 5 MB (or as needed)
   - **Allowed MIME types**: Leave empty (will handle in code)
   - Click "Create bucket"

## Step 2: Set up Storage Policies (Security Rules)

After creating the bucket, you need to set up policies:

### Option A: Public Read, Authenticated Write (Recommended for now)

1. Go to "Storage" → "Policies" tab
2. Click "New Policy" for the `product-images` bucket

**Policy 1: Allow Public Read**
```sql
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

**Policy 2: Allow Authenticated Upload**
```sql
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
```

**Policy 3: Allow Authenticated Delete**
```sql
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
```

### Option B: Public Access (For Development/Testing)

If you want to allow anyone to upload (not recommended for production):

```sql
CREATE POLICY "Public Access"
ON storage.objects FOR ALL
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');
```

## Step 3: Verify Setup

Test the upload by:

1. Go to your admin page: `http://localhost:3000/en/admin/products`
2. Click "Add New Product"
3. Go to the "Media" tab
4. Click "Upload Image" and select a file
5. You should see a success message and the image preview

## Storage Structure

Images will be stored with this naming pattern:
```
product-images/
  └── product-{timestamp}-{random}.{extension}
```

Example:
```
product-images/product-1704123456789-abc123def.jpg
```

## API Endpoints Created

### Upload Image
- **Endpoint**: `POST /api/upload/image`
- **Accepts**: `multipart/form-data` with `file` field
- **Returns**: `{ success: true, url: string, fileName: string }`
- **Validates**: File type (JPEG, PNG, WebP, GIF) and size (max 5MB)

### Delete Image
- **Endpoint**: `DELETE /api/upload/image?fileName={fileName}`
- **Returns**: `{ success: true }`

## Features

✅ **Image Upload**: Drag & drop or click to upload  
✅ **Preview**: Instant preview before saving  
✅ **Validation**: File type and size validation  
✅ **Unique Names**: Auto-generated unique filenames  
✅ **Public URLs**: Get public URLs automatically  
✅ **Delete**: Remove images when needed  
✅ **Multiple Images**: Support for product gallery  

## Usage in Admin Panel

### Main Image Upload
1. Click "Upload Image" button
2. Select image file (JPEG, PNG, WebP, GIF)
3. Image uploads automatically
4. URL is saved to the form

### Alternative: Manual URL Entry
- You can still enter image URLs manually if needed
- Useful for images hosted elsewhere

### Additional Images
- Upload images one by one
- Copy the URL and paste in the "Additional Images" textarea
- Each URL on a new line

## Security Notes

⚠️ **Important for Production:**

1. **Add Authentication**: Protect admin routes with authentication middleware
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Image Optimization**: Consider adding image compression
4. **CDN**: Use Supabase CDN for better performance
5. **Backups**: Enable automatic backups in Supabase

## Troubleshooting

### Error: "Upload failed: new row violates row-level security policy"
**Solution**: Make sure you've created the storage policies (Step 2)

### Error: "Invalid file type"
**Solution**: Only JPEG, PNG, WebP, and GIF are allowed

### Error: "File size too large"
**Solution**: Maximum file size is 5MB. Compress your image

### Images not displaying
**Solution**: Check if the bucket is set to "Public" in Supabase

## Optional: Image Optimization

For better performance, consider adding image optimization:

```bash
npm install sharp
```

Then update the upload API to resize/compress images before storing.

## Bucket Settings Verification

To verify your bucket is public:

1. Go to Storage → product-images
2. Click the settings icon
3. Ensure "Public" is enabled
4. Test by accessing a URL directly in your browser


