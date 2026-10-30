import { useCallback, useState } from 'react';
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog';

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

// const { confirm, confirmDialog } = useConfirm();
// if (await confirm({ title, message })) { ...action destructrice... }
// -> rendre {confirmDialog} quelque part dans le composant
export const useConfirm = () => {
    const [pending, setPending] = useState<PendingConfirm | null>(null);

    const confirm = useCallback(
        (options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })),
        []
    );

    const close = useCallback((confirmed: boolean) => {
        pending?.resolve(confirmed);
        setPending(null);
    }, [pending]);

    const onCancel = useCallback(() => close(false), [close]);
    const onConfirm = useCallback(() => close(true), [close]);

    const confirmDialog = pending ? (
        <ConfirmDialog
            title={pending.title}
            message={pending.message}
            confirmLabel={pending.confirmLabel}
            cancelLabel={pending.cancelLabel}
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    ) : null;

    return { confirm, confirmDialog };
};
