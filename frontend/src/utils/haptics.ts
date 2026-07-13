export const triggerVibration = (pattern: number | number[] = 50) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.warn("La vibration a été bloquée par le navigateur.", error);
        }
    }
};