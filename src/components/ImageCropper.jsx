import { useState, useRef } from 'react';
import { T } from '../constants/theme.js';
import { authBtn } from '../utils/styleUtils.js';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT: Image Cropper (RULE #21 & #22 - Custom Profile Picture)
// ═══════════════════════════════════════════════════════════════════
export function ImageCropper({ file, onCrop, onCancel }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef(null);

  const handleCrop = () => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 200;
        
        ctx.translate(100, 100);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.translate(-100, -100);
        ctx.drawImage(img, 0, 0, 200, 200);
        
        canvas.toBlob((blob) => {
          onCrop(blob);
        }, 'image/jpeg', 0.9);
      };
      img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ 
      background: 'rgba(0,0,0,0.8)', 
      padding: 24, 
      borderRadius: 12, 
      marginBottom: 16,
      border: `1px solid ${T.blue}30`
    }}>
      <div style={{ color: T.blue, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{"\uD83D\uDCF7"} CROP PROFILE PICTURE</div>
      
      <div style={{ marginBottom: 16 }}>
        <label style={{ color: T.muted, fontSize: 11, display: 'block', marginBottom: 8 }}>Zoom</label>
        <input 
          type="range" 
          min="1" 
          max="2" 
          step="0.1" 
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <label style={{ color: T.muted, fontSize: 11, display: 'block', marginBottom: 8 }}>Rotate (degrees)</label>
        <input 
          type="range" 
          min="0" 
          max="360" 
          step="15" 
          value={rotation}
          onChange={(e) => setRotation(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div style={{ display: 'flex', gap: 8 }}>
        <button 
          onClick={handleCrop}
          style={{...authBtn(T.green, false), flex: 1}}
          className="btn-glass"
        >
          {"\u2713"} CROP & USE
        </button>
        <button 
          onClick={onCancel}
          style={{...authBtn(T.red, false), flex: 1}}
          className="btn-glass"
        >
          {"\u2715"} CANCEL
        </button>
      </div>
    </div>
  );
}
