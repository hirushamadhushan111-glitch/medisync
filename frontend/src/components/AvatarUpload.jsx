/**
 * AvatarUpload — clickable profile-picture circle used on every profile
 * page. Shows the user's initial until a picture exists, previews the
 * chosen file instantly, uploads it to /auth/avatar (max 2 MB), and
 * updates the stored user so the navbar picture refreshes too.
 */
import { useRef, useState } from 'react';
import { Camera, Loader } from 'lucide-react';
import api from '../api/axiosInstance.js';
import { setStoredUser } from '../utils/authStorage';

// Server root (relative image paths are resolved against it).
const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

// Cloudinary returns a full https:// URL; local paths need the server prefix
export const avatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_URL}${path}`;
};

// Component (see header).
const AvatarUpload = ({ name, avatarPath, accentColor = '#1E3A5F', size = 80, onUploaded }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const initial = name?.[0]?.toUpperCase() || '?';
  const src = preview || avatarUrl(avatarPath);
  const [imgError, setImgError] = useState(false);

  // Check size, preview instantly, then upload.
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB.');
      return;
    }

    setError('');
    setImgError(false);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post('/auth/avatar', formData);
      setStoredUser(data.user);
      onUploaded?.(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
      setPreview(null);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        className="avatar-wrapper"
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          cursor: uploading ? 'default' : 'pointer',
          flexShrink: 0,
        }}
      >
        {/* Avatar image or initials */}
        {src && !imgError ? (
          <img
            src={src}
            alt={name}
            onError={() => setImgError(true)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
              border: `3px solid ${accentColor}22`,
            }}
          />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: accentColor,
              color: '#fff',
              fontSize: size * 0.35,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {initial}
          </div>
        )}

        {/* Hover overlay — shown via sibling CSS trick with :hover on parent */}
        <div
          className="avatar-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: uploading ? 'rgba(0,0,0,0.45)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          {uploading && <Loader size={size * 0.3} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />}
        </div>

        {/* Camera icon always visible at bottom-right */}
        {!uploading && (
          <div
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: accentColor,
              border: '2px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={12} color="#fff" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {error && <div style={{ fontSize: 11, color: '#DC2626', textAlign: 'center', maxWidth: 140 }}>{error}</div>}
      {!error && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Click to change photo</div>}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .avatar-wrapper:hover .avatar-overlay { background: rgba(0,0,0,0.38) !important; }
        .avatar-wrapper:hover .avatar-camera-badge { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default AvatarUpload;
