import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';
import Pagination from '@/components/pagination';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Form, Head, Link, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Templates',
        href: '/template',
    },
];

export default function SalarySlipTemplateIndex() {
    const { templates } = usePage<SharedData & { templates: any }>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Templates" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Templates</h1>
                    <Link
                        href="/template/create"
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                        Create
                    </Link>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/30 text-left">
                            <tr>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Module</th>
                                <th className="px-3 py-2">Design</th>
                                <th className="px-3 py-2">Active</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(templates?.data ?? []).length === 0 && (
                                <tr className="border-b border-sidebar-border/50 last:border-b-0">
                                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div>No data found.</div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {(templates?.data ?? []).map((t: any) => (
                                <tr
                                    key={t.id}
                                    className="border-b border-sidebar-border/50 last:border-b-0"
                                >
                                    <td className="px-3 py-2">{t.name}</td>
                                    <td className="px-3 py-2">
                                        {t.document_type
                                            ? t.document_type
                                                  .replace(/_/g, ' ')
                                                  .replace(/\b\w/g, (c: string) =>
                                                      c.toUpperCase(),
                                                  )
                                            : '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        {t.design_label ??
                                            t.design ??
                                            (t.code
                                                ? t.code.replace(/_/g, ' ')
                                                : '—')}
                                    </td>
                                    <td className="px-3 py-2">
                                        {t.is_active ? 'Yes' : 'No'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" asChild size="sm">
                                                <Link href={`/template/${t.id}/edit`}>Edit</Link>
                                            </Button>
                                            <ConfirmDeleteButton
                                                action={`/template/${t.id}`}
                                                itemLabel={`template ${t.name || t.id}`}
                                                triggerText="Delete"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={templates?.links} />
            </div>
        </AppLayout>
    );
}
