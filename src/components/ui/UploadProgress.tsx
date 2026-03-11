'use client';

interface UploadProgressProps {
  progress: number;
  isUploading: boolean;
}

export default function UploadProgress({ progress, isUploading }: UploadProgressProps) {
  if (!isUploading) return null;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span>Завантаження...</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
