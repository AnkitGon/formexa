import AppLayout from '@/layouts/app-layout';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import Pagination from '@/components/pagination';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Form, Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import TaxForm from './tax-form';
import { Button } from '@/components/ui/button';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Taxes',
        href: '/taxes',
    },
];

export default function TaxIndex() {
    const { taxes, typeOptions } = usePage<
        SharedData & { taxes: any; typeOptions: Record<string, string> }
    >().props;

    const errors = (usePage().props as any)?.errors ?? {};
    const hasErrors = Object.keys(errors ?? {}).length > 0;

    const taxesById = useMemo(() => {
        const map = new Map<number, any>();
        (taxes?.data ?? []).forEach((t: any) => map.set(Number(t.id), t));
        return map;
    }, [taxes]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [activeTaxId, setActiveTaxId] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!hasErrors) {
            setDialogOpen(false);
            setDialogMode('create');
            setActiveTaxId(null);
            window.localStorage.removeItem('taxesModalState');
            return;
        }

        const raw = window.localStorage.getItem('taxesModalState');
        if (!raw) {
            return;
        }

        try {
            const parsed = JSON.parse(raw) as { mode?: 'create' | 'edit'; taxId?: number | null };
            const nextMode = parsed?.mode === 'edit' ? 'edit' : 'create';
            const nextTaxId = nextMode === 'edit' ? Number(parsed?.taxId ?? null) : null;

            setDialogMode(nextMode);
            setActiveTaxId(Number.isFinite(nextTaxId as any) ? nextTaxId : null);
            setDialogOpen(true);
        } catch {
        }
    }, [hasErrors]);

    const activeTax = activeTaxId !== null ? taxesById.get(activeTaxId) : null;
    const formAction = dialogMode === 'create' ? '/taxes' : `/taxes/${activeTaxId}`;
    const dialogTitle = dialogMode === 'create' ? 'Create Tax' : 'Edit Tax';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Taxes" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Taxes</h1>
                    <button
                        type="button"
                        onClick={() => {
                            setDialogMode('create');
                            setActiveTaxId(null);
                            setDialogOpen(true);

                            if (typeof window !== 'undefined') {
                                window.localStorage.setItem(
                                    'taxesModalState',
                                    JSON.stringify({ mode: 'create', taxId: null }),
                                );
                            }
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground cursor-pointer"
                    >
                        Create
                    </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/30 text-left">
                            <tr>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Value</th>
                                <th className="px-3 py-2">Active</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(taxes?.data ?? []).length === 0 && (
                                <tr className="border-b border-sidebar-border/50 last:border-b-0">
                                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div>No data found.</div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {(taxes?.data ?? []).map((t: any) => (
                                <tr
                                    key={t.id}
                                    className="border-b border-sidebar-border/50 last:border-b-0"
                                >
                                    <td className="px-3 py-2">{t.name}</td>
                                    <td className="px-3 py-2">
                                        {typeOptions?.[t.type] ?? t.type}
                                    </td>
                                    <td className="px-3 py-2">{t.value}</td>
                                    <td className="px-3 py-2">
                                        {t.is_active ? 'Yes' : 'No'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" 
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    setDialogMode('edit');
                                                    setActiveTaxId(Number(t.id));
                                                    setDialogOpen(true);

                                                    if (typeof window !== 'undefined') {
                                                        window.localStorage.setItem(
                                                            'taxesModalState',
                                                            JSON.stringify({
                                                                mode: 'edit',
                                                                taxId: Number(t.id),
                                                            }),
                                                        );
                                                    }
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <ConfirmDeleteButton
                                                action={`/taxes/${t.id}`}
                                                itemLabel={`tax ${t.name}`}
                                                triggerText="Delete"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={taxes?.links} />
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        setDialogMode('create');
                        setActiveTaxId(null);

                        if (typeof window !== 'undefined') {
                            window.localStorage.removeItem('taxesModalState');
                        }
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                    </DialogHeader>

                    <TaxForm
                        key={`${dialogMode}-${activeTaxId ?? 'new'}`}
                        mode={dialogMode}
                        action={formAction}
                        typeOptions={typeOptions}
                        tax={dialogMode === 'edit' ? activeTax : undefined}
                        onSuccess={() => {
                            setDialogOpen(false);
                            setDialogMode('create');
                            setActiveTaxId(null);
                            if (typeof window !== 'undefined') {
                                window.localStorage.removeItem('taxesModalState');
                            }
                        }}
                    />
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
