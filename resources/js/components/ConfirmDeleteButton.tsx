import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { router, usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

interface ConfirmDeleteButtonProps {
    action: string;
    itemLabel?: string;
    size?: 'sm' | 'default' | 'lg';
    triggerText?: string;
}

export default function ConfirmDeleteButton({
    action,
    itemLabel = 'this item',
    size = 'sm',
    triggerText = 'Delete',
}: ConfirmDeleteButtonProps) {
    const { csrf_token } = usePage().props as { csrf_token?: string };
    const [open, setOpen] = useState(false);
    const formId = useId();

    const handleDelete = () => {
        router.delete(action, {
            preserveScroll: true,
            onFinish: () => setOpen(false),
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size={size} type="button">
                    {triggerText}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
                className="max-w-sm"
                overlayProps={{ onClick: () => setOpen(false) }}
                onEscapeKeyDown={() => setOpen(false)}
            >
                <AlertDialogHeader className="items-center text-center">
                    <div className="flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fce8e8] text-[#d72626]">
                            <Trash2 className="h-6 w-6" />
                        </div>
                    </div>
                    <AlertDialogTitle className="text-lg font-semibold">
                        Delete {itemLabel}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">
                        This action cannot be undone. This will permanently delete {itemLabel}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row justify-center gap-3">
                    <AlertDialogCancel
                        type="button"
                        className="mt-0 min-w-[110px] rounded-md h-9 px-3 text-sm"
                    >
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        asChild
                        className="min-w-[110px] rounded-md h-9 px-3 text-sm bg-[#d72626] text-white hover:bg-[#c11f1f] focus-visible:ring-[#d72626]"
                    >
                        <button type="button" onClick={handleDelete}>
                            Delete
                        </button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
