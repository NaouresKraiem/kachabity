"use client";

import { useRef, useState } from "react";
import { message } from "antd";
import Image from "next/image";

export interface GalleryImage {
    id?: string;
    url: string;
    alt?: string;
}

interface MultiImageUploadProps {
    label: string;
    value: GalleryImage[];
    onChange: (images: GalleryImage[]) => void;
    onPrimaryChange?: (url: string) => void;
    maxImages?: number;
}

export default function MultiImageUpload({ label, value, onChange, onPrimaryChange, maxImages = 8 }: MultiImageUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const filesArray = Array.from(files);

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const maxSize = 5 * 1024 * 1024;

        // Enforce max count
        if (value.length + filesArray.length > maxImages) {
            message.error(`You can upload up to ${maxImages} images.`);
            return;
        }

        setUploading(true);
        try {
            const uploaded: GalleryImage[] = [];
            for (const file of filesArray) {
                if (!validTypes.includes(file.type)) {
                    message.error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
                    continue;
                }
                if (file.size > maxSize) {
                    message.error('File size too large. Maximum size is 5MB.');
                    continue;
                }

                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
                const result = await response.json();
                if (result.success && result.url) {
                    uploaded.push({ url: result.url });
                } else {
                    message.error(result.error || 'Upload failed');
                }
            }

            if (uploaded.length > 0) {
                const next = [...value, ...uploaded];
                onChange(next);
                // If no primary yet and primary callback provided, set the first as primary
                if (onPrimaryChange && next.length > 0) {
                    onPrimaryChange(next[0].url);
                }
                message.success('Images uploaded successfully!');
            }
        } catch (e: unknown) {
            const errorMessage =
                e instanceof Error ? e.message : 'An unknown error occurred during upload';
            message.error(errorMessage);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemove = (index: number) => {
        const next = value.filter((_, i) => i !== index);
        onChange(next);
    };

    const move = (from: number, to: number) => {
        if (to < 0 || to >= value.length) return;
        const next = value.slice();
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {value.map((img, index) => (
                        <div key={(img.id || img.url) + index} className="relative group border rounded-lg overflow-hidden">
                            <Image
                                src={img.url}
                                alt={img.alt || `Image ${index + 1}`}
                                width={300}
                                height={200}
                                className="w-full h-28 object-cover"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button type="button" onClick={() => handleRemove(index)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Del</button>
                            </div>
                            <div className="absolute bottom-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button type="button" onClick={() => move(index, index - 1)} className="px-2 py-1 text-xs bg-white/90 rounded">←</button>
                                <button type="button" onClick={() => move(index, index + 1)} className="px-2 py-1 text-xs bg-white/90 rounded">→</button>
                                {onPrimaryChange && (
                                    <button type="button" onClick={() => onPrimaryChange(img.url)} className="px-2 py-1 text-xs bg-amber-500 text-white rounded">Primary</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#7a3b2e] transition text-gray-600 hover:text-[#7a3b2e] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? 'Uploading...' : value.length === 0 ? 'Upload Images' : 'Add More Images'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        multiple
                        onChange={(e) => handleFiles(e.target.files)}
                        className="hidden"
                    />
                </div>
                <p className="text-xs text-gray-500">Accepted: JPG, PNG, WebP, GIF. Max size: 5MB. Up to {maxImages} images.</p>
            </div>
        </div>
    );
}


