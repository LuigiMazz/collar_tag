
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const WIZARD_STEPS = [
    { icon: '📝', titleKey: 'wizardStep1Title', descKey: 'wizardStep1Desc' },
    { icon: '🔮', titleKey: 'wizardStep2Title', descKey: 'wizardStep2Desc' },
    { icon: '🖨️', titleKey: 'wizardStep3Title', descKey: 'wizardStep3Desc' },
];

export function WelcomeWizard({ onGenerate }) {
    const { t } = useTranslation();
    const [active, setActive] = useState(0);
    const [contentKey, setContentKey] = useState(0);
    const [progressKey, setProgressKey] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused) return;
        const id = setInterval(() => {
            setActive(a => (a + 1) % WIZARD_STEPS.length);
            setContentKey(k => k + 1);
            setProgressKey(k => k + 1);
        }, 3500);
        return () => clearInterval(id);
    }, [paused]);

    const goTo = (i) => {
        setActive(i);
        setContentKey(k => k + 1);
        setProgressKey(k => k + 1);
        setPaused(true);
    };

    const handleMouseLeave = () => {
        setPaused(false);
        setProgressKey(k => k + 1);
    };

    const { icon, titleKey, descKey } = WIZARD_STEPS[active];

    return (
        <div
            className="welcome-wizard"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={handleMouseLeave}
        >
            <div className="wizard-body" key={contentKey}>
                <div className="wizard-icon">{icon}</div>
                <span className="wizard-step-label">{active + 1} / {WIZARD_STEPS.length}</span>
                <h2 className="wizard-title">{t(titleKey)}</h2>
                <p className="wizard-desc">{t(descKey)}</p>
            </div>
            <div className="wizard-dots">
                {WIZARD_STEPS.map((_, i) => (
                    <button
                        key={i}
                        className={`wizard-dot${i === active ? ' active' : ''}`}
                        onClick={() => goTo(i)}
                        aria-label={`Step ${i + 1}`}
                    >
                        {i === active && (
                            <span
                                className="wizard-dot-progress"
                                key={progressKey}
                                style={{ animationPlayState: paused ? 'paused' : 'running' }}
                            />
                        )}
                    </button>
                ))}
            </div>
            <button className="btn btn-primary wizard-cta" onClick={onGenerate}>
                {t('btnGenerate')}
            </button>
        </div>
    );
}
