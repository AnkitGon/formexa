import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import SalarySlipTemplateForm from './template-form';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Templates',
        href: '/template',
    },
    {
        title: 'Create',
        href: '/template/create',
    },
];

export default function SalarySlipTemplateCreate() {
    const { designOptions } = usePage<SharedData & { designOptions: any }>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Template" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Create Template</h1>
                    <Link
                        href="/template"
                        className="rounded-md border border-sidebar-border/70 px-3 py-2 text-sm"
                    >
                        Back
                    </Link>
                </div>

                <SalarySlipTemplateForm
                    mode="create"
                    action="/template"
                    designOptions={designOptions}
                />
            </div>
        </AppLayout>
    );
}
