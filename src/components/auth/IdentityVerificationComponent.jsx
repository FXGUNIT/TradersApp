import { useState, useRef } from 'react';
import { T } from '../../constants/theme.js';
import { authBtn, lbl, authInp } from '../../utils/styleUtils.js';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT: Identity Verification Upload (RULE #24 - KYC Documents)
// ═══════════════════════════════════════════════════════════════════
export function IdentityVerificationComponent({ uid, onSuccess, onError, showToast, uploadIdentityDoc }) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('aadhar');
  const [uploadedDocs, setUploadedDocs] = useState({});
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadIdentityDoc(file, uid, docType);
      
      setUploadedDocs(prev => ({
        ...prev,
        [docType]: result
      }));
      
      showToast && showToast(`${docType.toUpperCase()} ingested into the archive. Scanning complete.`, 'success');
      onSuccess && onSuccess(result);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      showToast && showToast('Data transmission halted. The cloud servers are meditating.', 'error');
      onError && onError(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(52,199,89,0.1)',
      border: `1px solid ${T.green}50`,
      padding: 16,
      borderRadius: 10,
      marginBottom: 16
    }}>
      <div style={{ color: T.green, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{"\u2713"} IDENTITY PROOF (RULE #24)</div>
      
      <div style={{ marginBottom: 12 }}>
        <label style={{...lbl, marginBottom: 8}}>Document Type</label>
        <select 
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          disabled={uploading}
          style={{
            ...authInp,
            width: '100%',
            background: 'rgba(0,0,0,0.4)',
            color: T.blue,
            padding: '8px 12px'
          }}
        >
          <option value="aadhar">Aadhar Card</option>
          <option value="passport">Passport</option>
          <option value="license">Driving License</option>
          <option value="pan">PAN Card</option>
        </select>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.pdf"
        onChange={handleFileSelect}
        disabled={uploading}
        style={{ display: 'none' }}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{...authBtn(T.green, uploading), width: '100%'}}
        className="btn-glass"
      >
        {uploading ? '\u231B UPLOADING...' : '\uD83D\uDCC4 SELECT & UPLOAD'}
      </button>
      
      {Object.entries(uploadedDocs).length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.green}30` }}>
          <div style={{ color: T.green, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Uploaded Documents:</div>
          {Object.entries(uploadedDocs).map(([type, doc]) => (
            <div key={type} style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
              {"\u2022"} {type.toUpperCase()}: {doc.fileName}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
