import { useRef } from 'react';
import './PhotoUpload.css';

interface PhotoUploadProps {
  objectUrl: string | null;
  onSelect: (file: File) => void;
}

/**
 * The photo is treated as a physical object: a photograph taped onto a warm
 * paper mat. The torn edges come from a CSS mask-image data-URI — an SVG
 * whose white rect is displaced by an feTurbulence + feDisplacementMap
 * filter — so only the photo's silhouette edge is torn and the photograph's
 * pixels are never displaced. Keeping the mask entirely inside CSS makes it
 * self-contained and reliable in every browser (no zero-size SVG defs, no
 * ResizeObserver sizing). A paper label, two small pieces of masking tape,
 * grain and a soft drop shadow complete the "printed summer poster" feel.
 */
export function PhotoUpload({ objectUrl, onSelect }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div className="photo-upload">
      <button
        type="button"
        className="photo-upload__well"
        onClick={() => inputRef.current?.click()}
        aria-label="Upload your photo"
      >
        <span className="photo-upload__mat" aria-hidden="true" />
        <span className="photo-upload__tape photo-upload__tape--tl" aria-hidden="true" />
        <span className="photo-upload__tape photo-upload__tape--br" aria-hidden="true" />

        <span className={`photo-upload__frame ${objectUrl ? 'has-photo' : ''}`}>
          {objectUrl ? (
            <img src={objectUrl} alt="Your uploaded photo" />
          ) : (
            <span className="photo-upload__placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              <span className="p1">Drop Photo</span>
              <span className="p2">tap to upload</span>
            </span>
          )}
          <span className="photo-upload__grain" aria-hidden="true" />
        </span>

        <span className="photo-upload__label">you</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="photo-upload__input"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
