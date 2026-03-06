
import { useTranslation } from 'react-i18next';
import TagScene from '../TagScene';
import { useTagEditor } from '../../hooks/useTagEditor';
import { Sidebar } from './Sidebar';
import { WelcomeWizard } from './WelcomeWizard';
import { TutorialModal } from './TutorialModal';
import { WriteLaterModal } from './WriteLaterModal';

export default function TagEditor() {
    const { t } = useTranslation();
    const { state, setters, actions } = useTagEditor();
    const { mesh, loading, autoRot } = state;
    const { handleGenerate } = actions;

    return (
        <>
            <div className="app-container">
                <Sidebar state={state} setters={setters} actions={actions} />

                <main className="canvas-wrapper">
                    {mesh ? (
                        <TagScene mesh={mesh} autoRotate={autoRot} />
                    ) : (
                        <div className="canvas-placeholder">
                            {loading ? (
                                <p>{t('msgLoadingGeometry')}</p>
                            ) : (
                                <WelcomeWizard onGenerate={handleGenerate} />
                            )}
                        </div>
                    )}
                </main>
            </div>

            <TutorialModal state={state} setters={setters} actions={actions} />
            {state.showWriteLater && (
                <WriteLaterModal
                    url={state.cardUrl}
                    onClose={() => setters.setShowWriteLater(false)}
                />
            )}
        </>
    );
}
