
import { useTranslation } from 'react-i18next';

export function TutorialModal({ state, setters, actions }) {
    const { t } = useTranslation();
    const { showTutorial, showNFCGuide, useNFC, cardUrl } = state;
    const { setShowTutorial, setShowNFCGuide } = setters;
    const { triggerDownloadSTL } = actions;

    if (showTutorial) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2>{t('tutorialTitle')}</h2>
                    <p className="tutorial-text" dangerouslySetInnerHTML={{ __html: t('tutorialText') }} />

                    <div className="tutorial-info-box">
                        <div className="info-header">
                            <span className="info-icon">💡</span><p><strong>INFO:</strong></p>
                        </div>
                        <p dangerouslySetInnerHTML={{ __html: t('tutorialInfoNozzle') }} />
                        <p dangerouslySetInnerHTML={{ __html: t('tutorialInfoNozzle04') }} />
                    </div>

                    <div className="tutorial-media-container">
                        <video
                            src="/tutorial.mov"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="tutorial-video"
                        >
                            {t('videoFallback')}
                        </video>
                    </div>

                    {useNFC && (
                        <div className="nfc-tutorial-section">
                            <h3>{t('nfcTutorialTitle')}</h3>
                            <p className="nfc-tutorial-intro" dangerouslySetInnerHTML={{ __html: t('nfcTutorialIntro') }} />
                            <a
                                className="nfc-amazon-link"
                                href="https://www.amazon.it/s?k=NFC+tag+25mm+coin"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {t('nfcAmazonLink')}
                            </a>
                            <ol className="nfc-steps">
                                <li dangerouslySetInnerHTML={{ __html: t('nfcStep1') }} />
                                <li dangerouslySetInnerHTML={{ __html: t('nfcStep2') }} />
                                <li dangerouslySetInnerHTML={{ __html: t('nfcStep3') }} />
                                <li dangerouslySetInnerHTML={{ __html: t('nfcStep4') }} />
                                <li dangerouslySetInnerHTML={{ __html: t('nfcStep5') }} />
                            </ol>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowTutorial(false)}
                        >
                            {t('btnCancel')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={triggerDownloadSTL}
                        >
                            {t('btnDownloadNow')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (showNFCGuide) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2>{t('nfcGuideTitle')}</h2>

                    <div className="nfc-guide-platform">
                        <h3>{t('androidGuideTitle')}</h3>
                        <ol className="nfc-steps">
                            <li dangerouslySetInnerHTML={{ __html: t('androidStep1') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('androidStep2') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('androidStep3') }} />
                            <li>{t('androidStep4')}</li>
                        </ol>
                    </div>

                    <div className="nfc-guide-platform">
                        <h3>{t('iosGuideTitle')}</h3>
                        <p dangerouslySetInnerHTML={{ __html: t('iosGuideIntro') }} />
                        <ol className="nfc-steps">
                            <li dangerouslySetInnerHTML={{ __html: t('iosStep1') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('iosStep2') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('iosStep3') }} />
                            <li>
                                {t('iosStep4Label')}
                                <div className="nfc-url-box">{cardUrl}</div>
                            </li>
                            <li dangerouslySetInnerHTML={{ __html: t('iosStep5') }} />
                        </ol>
                    </div>

                    <div className="modal-actions">
                        <button className="btn btn-primary" onClick={() => setShowNFCGuide(false)}>
                            {t('btnClose')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
