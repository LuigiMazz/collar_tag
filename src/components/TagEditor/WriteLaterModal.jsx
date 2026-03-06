
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';
import './WriteLaterModal.css';

export function WriteLaterModal({ url, onClose }) {
    const { t } = useTranslation();
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Add mode=nfc to the URL
        const nfcUrl = new URL(url);
        nfcUrl.searchParams.set('mode', 'nfc');
        const finalUrl = nfcUrl.toString();

        const qr = qrcode(0, 'M');
        qr.addData(finalUrl);
        qr.make();
        setQrDataUrl(qr.createDataURL(5));
    }, [url]);

    const handleCopy = () => {
        const nfcUrl = new URL(url);
        nfcUrl.searchParams.set('mode', 'nfc');
        navigator.clipboard.writeText(nfcUrl.toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content write-later-modal">
                <button className="modal-close" onClick={onClose}>&times;</button>

                <h2>{t('writeLaterTitle')}</h2>
                <p>{t('writeLaterDesc')}</p>

                <div className="qr-container">
                    {qrDataUrl && <img src={qrDataUrl} alt="QR Code for Mobile" className="qr-img" />}
                </div>

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={handleCopy}>
                        {copied ? t('writeLaterLinkCopied') : t('writeLaterLinkCopy')}
                    </button>
                </div>
            </div>
        </div>
    );
}
