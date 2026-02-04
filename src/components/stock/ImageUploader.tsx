'use client';

import { useRef, useState } from 'react';
import { UploadIcon, TrashIcon, StarIcon, CloseIcon } from '@/components/ui/icons';
import { API_BASE_URL } from '@/lib/api-config';
import type { ProductImage } from '@/lib/user-stock-api';

interface ImageUploaderProps {
  existingImages: ProductImage[];
  newFiles: File[];
  onFilesAdded: (files: File[]) => void;
  onRemoveNewFile: (index: number) => void;
  onDeleteExisting: (imageId: string) => void;
  onSetPrimary: (imageId: string) => void;
}

export function ImageUploader({
  existingImages,
  newFiles,
  onFilesAdded,
  onRemoveNewFile,
  onDeleteExisting,
  onSetPrimary,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)
    );
    if (files.length > 0) onFilesAdded(files);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-zinc-300">Images</label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <UploadIcon className="w-6 h-6 mx-auto text-zinc-500 mb-1" />
        <p className="text-sm text-zinc-400">Drop images here or click to upload</p>
        <p className="text-xs text-zinc-600 mt-1">JPEG, PNG, WebP, GIF - Max 5MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Thumbnails */}
      {(existingImages.length > 0 || newFiles.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {/* Existing images */}
          {existingImages.map((img) => (
            <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-white/10">
              <img
                src={`${API_BASE_URL}${img.url}`}
                alt=""
                className="w-full h-full object-cover"
              />
              {img.isPrimary && (
                <div className="absolute top-0.5 left-0.5">
                  <StarIcon className="w-4 h-4 text-amber-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSetPrimary(img.id); }}
                    className="p-1 text-amber-400 hover:text-amber-300"
                    title="Set as primary"
                  >
                    <StarIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteExisting(img.id); }}
                  className="p-1 text-red-400 hover:text-red-300"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* New files (pending upload) */}
          {newFiles.map((file, i) => (
            <div key={`new-${i}`} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-emerald-500/30">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute top-0 right-0 p-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveNewFile(i); }}
                  className="bg-black/70 rounded-full p-0.5 text-red-400 hover:text-red-300"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 text-[9px] text-white text-center py-0.5">
                New
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
