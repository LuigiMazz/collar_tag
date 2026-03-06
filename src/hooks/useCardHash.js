
import { useState, useEffect } from 'react';
import { readCardHash } from '../utils/url';

export function useCardHash() {
    const [cardParams, setCardParams] = useState(() => readCardHash());

    useEffect(() => {
        const onHash = () => setCardParams(readCardHash());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    return cardParams;
}
