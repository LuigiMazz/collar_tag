
import { useCardHash } from './hooks/useCardHash';
import PetCard from './components/PetCard';
import TagEditor from './components/TagEditor';
import NFCWriter from './components/TagEditor/NFCWriter';
import './App.css';

export default function App() {
  const cardParams = useCardHash();

  const query = new URLSearchParams(window.location.search);
  const isNfcMode = query.get('mode') === 'nfc';

  if (cardParams) {
    if (isNfcMode) {
      return (
        <NFCWriter
          name={cardParams.name}
          phone={cardParams.phone}
          phone2={cardParams.phone2}
          description={cardParams.description}
        />
      );
    }
    return (
      <PetCard
        name={cardParams.name}
        phone={cardParams.phone}
        phone2={cardParams.phone2}
        description={cardParams.description}
      />
    );
  }

  return <TagEditor />;
}

