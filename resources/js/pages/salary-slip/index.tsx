import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, usePage, Form } from '@inertiajs/react';
import Pagination from '@/components/pagination';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Salary Slips',
        href: '/salary-slip',
    },
];

export default function SalarySlipIndex() {
    const { salarySlips } = usePage<SharedData & { salarySlips: any }>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Salary Slips" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Salary Slips</h1>
                    <Link
                        href="/salary-slip/create"
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                        Create
                    </Link>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/30 text-left">
                            <tr>
                                <th className="px-3 py-2">Template</th>
                                <th className="px-3 py-2">Employee</th>
                                <th className="px-3 py-2 text-right">Net Salary</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(salarySlips?.data ?? []).length === 0 && (
                                <tr className="border-b border-sidebar-border/50 last:border-b-0">
                                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div>No data found.</div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {(salarySlips?.data ?? []).map((slip: any) => (
                                <tr
                                    key={slip.id}
                                    className="border-b border-sidebar-border/50 last:border-b-0"
                                >
                                    <td className="px-3 py-2">
                                        {slip.template?.name ?? ''}
                                    </td>
                                    <td className="px-3 py-2">
                                        {slip.meta?.employee_name ?? ''}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {Number(slip.net_salary ?? 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" asChild size="sm">
                                                <Link href={`/salary-slip/${slip.id}`}>View</Link>
                                            </Button>
                                            <Button variant="outline" asChild size="sm">
                                                <Link href={`/salary-slip/${slip.id}/edit`}>Edit</Link>
                                            </Button>
                                            <Button variant="outline" asChild size="sm">
                                                <a href={`/salary-slip/${slip.id}/download`}>Download</a>
                                            </Button>
                                            <ConfirmDeleteButton
                                                action={`/salary-slip/${slip.id}`}
                                                itemLabel={`salary slip ${slip.code ?? slip.id}`}
                                                triggerText="Delete"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={salarySlips?.links} />
            </div>
        </AppLayout>
    );
}
