
import AppLayout from '@/layouts/app-layout';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/input-error';
import { Form, Head, useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Client {
    id: number;
    name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
}

interface Paginator<T> {
    data: T[];
    links?: Array<{ url: string | null; label: string; active: boolean }>;
}

export default function Index({ clients }: { clients: Paginator<Client> }) {
    const items = clients?.data ?? [];
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [activeClientId, setActiveClientId] = useState<number | null>(null);

    const clientsById = useMemo(() => {
        const map = new Map<number, Client>();
        (clients?.data ?? []).forEach((c: Client) => map.set(Number(c.id), c));
        return map;
    }, [clients]);

    const {
        data,
        setData,
        post,
        put,
        processing,
        errors,
        reset,
    } = useForm({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
    });

    useEffect(() => {
        if (Object.keys(errors ?? {}).length > 0) {
            setDialogOpen(true);
        }
    }, [errors]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Clients', href: '/clients' }]}>
            <Head title="Clients" />

            <div className="flex flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Clients</h1>
                    <Button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground cursor-pointer"
                        onClick={() => {
                            reset();
                            setDialogMode('create');
                            setActiveClientId(null);
                            setDialogOpen(true);
                        }}
                    >
                        Create
                    </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/30 text-left">
                            <tr>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Company</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Phone</th>
                                <th className="px-3 py-2">Address</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr className="border-b border-sidebar-border/50 last:border-b-0">
                                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div>No data found.</div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {items.map((client) => (
                                <tr
                                    key={client.id}
                                    className="border-b border-sidebar-border/50 last:border-b-0"
                                >
                                    <td className="px-3 py-2 font-medium text-foreground">
                                        {client.name}
                                    </td>
                                    <td className="px-3 py-2">{client.company_name ?? '—'}</td>
                                    <td className="px-3 py-2">{client.email ?? '—'}</td>
                                    <td className="px-3 py-2">{client.phone ?? '—'}</td>
                                    <td className="px-3 py-2">
                                        {client.address ? (
                                            <span className="line-clamp-2 whitespace-pre-line">{client.address}</span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setDialogMode('edit');
                                                    setActiveClientId(Number(client.id));
                                                    setData({
                                                        name: client.name ?? '',
                                                        company_name: client.company_name ?? '',
                                                        email: client.email ?? '',
                                                        phone: client.phone ?? '',
                                                        address: client.address ?? '',
                                                        notes: '',
                                                    });
                                                    setDialogOpen(true);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <ConfirmDeleteButton
                                                action={`/clients/${client.id}`}
                                                itemLabel={`client ${client.name}`}
                                                triggerText="Delete"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={clients?.links} />
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        reset();
                        setDialogMode('create');
                        setActiveClientId(null);
                    }
                }}
            >
                <DialogContent
                    className="max-w-xl"
                    onOpenAutoFocus={(event) => {
                        // Avoid auto-selecting prefilled text when opening the edit modal.
                        event.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{dialogMode === 'create' ? 'Create Client' : 'Edit Client'}</DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (dialogMode === 'edit' && activeClientId !== null) {
                                put(`/clients/${activeClientId}`, {
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        reset();
                                        setDialogMode('create');
                                        setActiveClientId(null);
                                        setDialogOpen(false);
                                    },
                                });
                            } else {
                                post('/clients', {
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        reset();
                                        setDialogOpen(false);
                                    },
                                });
                            }
                        }}
                        className="space-y-4"
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="company_name">Company Name</Label>
                            <Input
                                id="company_name"
                                value={data.company_name}
                                onChange={(e) => setData('company_name', e.target.value)}
                            />
                            <InputError message={errors.company_name} />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                />
                                <InputError message={errors.email} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                />
                                <InputError message={errors.phone} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                rows={3}
                            />
                            <InputError message={errors.address} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                rows={2}
                            />
                            <InputError message={errors.notes} />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
