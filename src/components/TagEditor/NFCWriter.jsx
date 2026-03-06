
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './NFCWriter.css';

export default function NFCWriter({ name, phone, phone2, description }) {
    const { t } = useTranslation();
    const [status, setStatus] = useState('idle'); // idle, ready, writing, success, error
    const [error, setError] = useState('');

    const handleWrite = async () => {
        if (!('NDEFReader' in window)) {
            setStatus('error');
            setError('Web NFC not supported');
            return;
        }

        try {
            setStatus('ready');
            const ndef = new window.NDEFReader();
            // We need to rebuild the URL here or pass it in. 
            // For simplicity in this standalone view, we use the current window.location.href 
            // but without the mode=nfc param if we want the tag to point to the card.
            const url = new URL(window.location.href);
            url.searchParams.delete('mode');
            const targetUrl = url.toString();

            await ndef.write({
                records: [{ recordType: 'url', data: targetUrl }]
            });
            setStatus('success');
        } catch (err) {
            console.error(err);
            setStatus('error');
            setError(err.message || t('msgNfcError'));
        }
    };

    return (
        <div className="nfc-writer-container">
            <header className="nfc-writer-header">
                <img src="/logo.png" alt="Logo" className="nfc-logo" />
                <h1>{t('nfcWriterTitle')}</h1>
            </header>

            <main className="nfc-writer-content">
                <div className="pet-summary">
                    <div className="pet-icon">🐾</div>
                    <h2>{name}</h2>
                    <p>{phone}</p>
                    {phone2 && <p>{phone2}</p>}
                </div>

                <p className="nfc-instruction">{t('nfcWriterDesc')}</p>

                {status === 'idle' && (
                    <button className="btn btn-nfc-large" onClick={handleWrite}>
                        {t('btnStartNfcWrite')}
                    </button>
                )}

                {status === 'ready' && (
                    <div className="nfc-status-box info">
                        <div className="spinner"></div>
                        <p>{t('msgNfcReady')}</p>
                    </div>
                )}

                {status === 'writing' && (
                    <div className="nfc-status-box info">
                        <div className="spinner"></div>
                        <p>{t('msgNfcWriting')}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="nfc-status-box success">
                        <div className="status-icon">✅</div>
                        <p>{t('msgNFCSuccess')}</p>
                        <button className="btn btn-secondary" onClick={() => window.location.href = '/'}>
                            {t('btnClose')}
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="nfc-status-box error">
                        <div className="status-icon">❌</div>
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={handleWrite}>
                            {t('btnStartNfcWrite')}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
