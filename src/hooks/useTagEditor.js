
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { buildTagMesh, getTagConfig } from '../utils/geometry';
import { generateQRMatrix } from '../utils/qr';
import { exportSTL as actualExportSTL } from '../utils/exporter';
import { buildCardUrl } from '../utils/url';

export function useTagEditor() {
    const { t } = useTranslation();

    const [name, setName] = useState('LUNA');
    const [phone, setPhone] = useState('3331234567');
    const [phone2, setPhone2] = useState('');
    const [description] = useState('');
    const [diameter, setDiameter] = useState(30);
    const [minimalQR, setMinimalQR] = useState(false);
    const [useNFC, setUseNFC] = useState(false);
    const [autoRot] = useState(true);
    const [mesh, setMesh] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [qrInfo, setQrInfo] = useState({ version: 0, moduleSize: 0 });
    const [showTutorial, setShowTutorial] = useState(false);
    const [showNFCGuide, setShowNFCGuide] = useState(false);
    const [nfcStatus, setNfcStatus] = useState(null); // null | 'writing' | 'success' | 'error'
    const [nfcError, setNfcError] = useState('');
    const [showWriteLater, setShowWriteLater] = useState(false);

    const meshRef = useRef(null);
    const cardUrlRef = useRef('');

    const handleGenerate = useCallback(async () => {
        if (!name.trim()) { setError(t('errName')); return; }
        if (!phone.trim()) { setError(t('errPhone')); return; }

        setLoading(true);
        setError(null);

        try {
            await new Promise(r => setTimeout(r, 50));

            const url = buildCardUrl(name, phone, phone2, description, minimalQR);
            cardUrlRef.current = url;

            const qrMatrix = generateQRMatrix(url, 0, 'M');
            const count = qrMatrix.length;
            const version = (count - 17) / 4;

            const mSize = getTagConfig(diameter).qrSize / count;

            setQrInfo({ version, moduleCount: count, moduleSize: mSize });

            const newMesh = buildTagMesh(qrMatrix, name, phone, phone2, 'white', diameter, useNFC);

            meshRef.current = newMesh;
            setMesh(newMesh);
        } catch (err) {
            console.error(err);
            setError(t('errGeneral'));
        } finally {
            setLoading(false);
        }
    }, [name, phone, phone2, description, minimalQR, diameter, useNFC, t]);

    const handleExportSTL = useCallback(() => {
        if (!meshRef.current) return;
        setShowTutorial(true);
    }, []);

    const triggerDownloadSTL = useCallback(() => {
        actualExportSTL(meshRef.current, `pawtag3d_${name.toLowerCase().replace(/\s+/g, '_')}`);
        setShowTutorial(false);
    }, [name]);

    const handleWriteNFC = useCallback(async () => {
        const url = cardUrlRef.current;
        if (!url) return;

        if (!('NDEFReader' in window)) {
            setShowNFCGuide(true);
            return;
        }

        try {
            setNfcStatus('writing');
            setNfcError('');
            const ndef = new window.NDEFReader();
            await ndef.write({ records: [{ recordType: 'url', data: url }] });
            setNfcStatus('success');
        } catch (e) {
            setNfcStatus('error');
            setNfcError(e.message);
        }
    }, []);

    const handlePreviewCard = useCallback(() => {
        const url = buildCardUrl(name, phone, phone2, description);
        window.open(url, '_blank');
    }, [name, phone, phone2, description]);

    return {
        state: {
            name, phone, phone2, description, diameter, minimalQR, useNFC, autoRot,
            mesh, loading, error, qrInfo, showTutorial, showNFCGuide, nfcStatus, nfcError,
            cardUrl: cardUrlRef.current, showWriteLater
        },
        setters: {
            setName, setPhone, setPhone2, setDiameter, setMinimalQR, setUseNFC,
            setShowTutorial, setShowNFCGuide, setShowWriteLater
        },
        actions: {
            handleGenerate,
            handleExportSTL,
            triggerDownloadSTL,
            handleWriteNFC,
            handlePreviewCard
        }
    };
}
