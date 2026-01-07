
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/pagination';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { Plus, Eye, Pencil, FileText } from 'lucide-react';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';

interface Client {
    id: number;
    name: string;
    company_name: string | null;
}

interface Invoice {
    id: number;
    invoice_number: string;
    invoice_date: string;
    due_date: string | null;
    status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
    total: number;
    client: Client | null;
}

interface Settings {
    date_format?: string | null;
}

interface Paginator<T> {
    data: T[];
    links?: Array<{ url: string | null; label: string; active: boolean }>;
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    sent: "default",
    paid: "default",
    partially_paid: "default",
    overdue: "destructive",
    cancelled: "outline",
};

export default function Index({ invoices }: { invoices: Paginator<Invoice> }) {
    const { settings } = usePage<{ settings?: Settings }>().props;
    const dateFormat = (settings?.date_format as string | null) ?? 'YYYY-MM-DD';

    const formatDate = (value?: string | null) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        const tokens: Record<string, string> = {
            YYYY: String(d.getFullYear()),
            MM: String(d.getMonth() + 1).padStart(2, '0'),
            DD: String(d.getDate()).padStart(2, '0'),
        };
        return dateFormat.replace(/YYYY|MM|DD/g, (t) => tokens[t] ?? t);
    };

    const items = invoices?.data ?? [];

    return (
        <AppLayout breadcrumbs={[{ title: 'Invoices', href: '/invoices' }]}>
            <Head title="Invoices" />

            <div className="flex flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                    </div>
                    <div className="flex gap-2">
                        <Link
                            href="/invoices/create"
                            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                        >
                            Create
                        </Link>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/30 text-left">
                                <tr>
                                    <th className="px-4 py-3">Invoice</th>
                                    <th className="px-4 py-3">Client</th>
                                    <th className="px-4 py-3">Dates</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
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

                                {items.map((invoice) => (
                                    <tr key={invoice.id} className="border-b border-sidebar-border/50 last:border-b-0">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{invoice.invoice_number}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {invoice.client?.company_name || invoice.client?.name || 'Unknown Client'}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground text-sm">
                                            Issued: {formatDate(invoice.invoice_date)}
                                            {invoice.due_date && ` • Due: ${formatDate(invoice.due_date)}`}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Badge variant={statusColors[invoice.status] || 'default'}>
                                                {invoice.status.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold">
                                            ${Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/invoices/${invoice.id}`}>View</Link>
                                                </Button>
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
                                                </Button>
                                                <ConfirmDeleteButton
                                                    action={`/invoices/${invoice.id}`}
                                                    itemLabel={`invoice ${invoice.invoice_number}`}
                                                    triggerText="Delete"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={invoices?.links} className="border-t" />
            </div>
        </AppLayout>
    );
}
