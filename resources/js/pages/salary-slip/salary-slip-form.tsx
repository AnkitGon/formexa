import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type SharedData } from '@/types';
import { Form, Link, usePage } from '@inertiajs/react';
import { Minus, Plus } from 'lucide-react';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type KeyValueRow = {
    key: string;
    label: string;
    value: string;
};

type LabelValueRow = {
    label: string;
    value: string;
};

type AmountRow = {
    label: string;
    amount: string;
    tax_id?: string;
};

type TaxRow = {
    id: number;
    name: string;
    type: 'fixed' | 'percentage' | string;
    value: number | string;
    is_active?: boolean;
};

type Props = {
    mode: 'create' | 'edit';
    action: string;
    templates: any[];
    taxes: TaxRow[];
    salarySlip?: any;
    showExtraSections?: boolean;
};

function ensureUniqueKey(base: string, used: Set<string>) {
    if (!base) {
        base = 'field';
    }

    let key = base;
    let i = 2;
    while (used.has(key)) {
        key = `${base}_${i}`;
        i++;
    }
    return key;
}

export default function SalarySlipForm({
    mode,
    action,
    templates,
    taxes,
    salarySlip,
    showExtraSections = false,
}: Props) {
    const { settingsDefaults } = usePage<SharedData>().props;
    const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    const signaturePreviewSrc = useCallback((value: string) => {
        const v = String(value ?? '').trim();
        if (!v) {
            return '';
        }
        if (v.startsWith('data:image/')) {
            return v;
        }
        if (v.startsWith('http://') || v.startsWith('https://')) {
            return v;
        }
        if (v.startsWith('/')) {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            return origin ? `${origin}${v}` : v;
        }
        return v;
    }, []);

    const [documentTemplateId, setDocumentTemplateId] = useState<string>(() =>
        String(
            mode === 'edit'
                ? salarySlip?.document_template_id ?? ''
                : templates?.[0]?.id ?? '',
        ),
    );

    const tryShowNativeDatePicker = (el: HTMLInputElement) => {
        const maybe = el as HTMLInputElement & { showPicker?: () => void };
        try {
            maybe.showPicker?.();
        } catch {
        }
    };

    const [employerSignature, setEmployerSignature] = useState<string>(
        mode === 'edit'
            ? String(salarySlip?.meta?.employer_signature ?? '')
            : '',
    );
    const [employeeSignature, setEmployeeSignature] = useState<string>(
        mode === 'edit'
            ? String(salarySlip?.meta?.employee_signature ?? '')
            : '',
    );

    const [employerSignatureFileError, setEmployerSignatureFileError] =
        useState<string>('');
    const [employeeSignatureFileError, setEmployeeSignatureFileError] =
        useState<string>('');

    const validateSignatureFile = useCallback((file: File | null) => {
        if (!file) {
            return '';
        }

        const allowedMimeTypes = new Set([
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
        ]);

        if (!allowedMimeTypes.has(file.type)) {
            return 'Only image files are allowed (PNG, JPG, JPEG, WEBP).';
        }

        return '';
    }, []);

    const [employerSignatureMode, setEmployerSignatureMode] = useState<
        'draw' | 'upload'
    >(mode === 'edit' && employerSignature ? 'upload' : 'draw');
    const [employeeSignatureMode, setEmployeeSignatureMode] = useState<
        'draw' | 'upload'
    >(mode === 'edit' && employeeSignature ? 'upload' : 'draw');

    const [employerSignatureFileKey, setEmployerSignatureFileKey] = useState(0);
    const [employeeSignatureFileKey, setEmployeeSignatureFileKey] = useState(0);

    const employerCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const employeeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const employerIsDrawingRef = useRef(false);
    const employeeIsDrawingRef = useRef(false);
    const employerLastPointRef = useRef<{ x: number; y: number } | null>(null);
    const employeeLastPointRef = useRef<{ x: number; y: number } | null>(null);

    const initialPayslipFields = (): KeyValueRow[] => {
        if (mode === 'edit') {
            const labels = salarySlip?.meta?.payslip_labels;
            if (labels && typeof labels === 'object') {
                const rows = Object.entries(labels).map(([key, label]) => ({
                    key,
                    label: String(label ?? ''),
                    value: String(salarySlip?.meta?.[key] ?? ''),
                }));
                if (rows.length > 0) {
                    return rows;
                }
            }

            return [
                {
                    key: 'pay_date',
                    label: 'Pay Date',
                    value: String(
                        salarySlip?.meta?.pay_date ??
                            salarySlip?.meta?.pay_period ??
                            '',
                    ),
                },
                {
                    key: 'working_days',
                    label: 'Working Days',
                    value: String(
                        salarySlip?.meta?.working_days ??
                            salarySlip?.meta?.worked_days ??
                            '',
                    ),
                },
            ];
        }

        return [
            { key: 'pay_date', label: 'Pay Date', value: '' },
            { key: 'working_days', label: 'Working Days', value: '' },
        ];
    };

    const initialEmployeeFields = (): KeyValueRow[] => {
        if (mode === 'edit') {
            const labels = salarySlip?.meta?.employee_labels;
            if (labels && typeof labels === 'object') {
                const rows = Object.entries(labels).map(([key, label]) => ({
                    key,
                    label: String(label ?? ''),
                    value: String(salarySlip?.meta?.[key] ?? ''),
                }));
                if (rows.length > 0) {
                    return rows;
                }
            }

            return [
                {
                    key: 'employee_name',
                    label: 'Employee Name',
                    value: String(salarySlip?.meta?.employee_name ?? ''),
                },
                {
                    key: 'employee_code',
                    label: 'Employee ID',
                    value: String(salarySlip?.meta?.employee_code ?? ''),
                },
            ];
        }

        return [
            { key: 'employee_name', label: 'Employee Name', value: '' },
            { key: 'employee_code', label: 'Employee ID', value: '' },
        ];
    };

    const initialEarnings = (): AmountRow[] => {
        if (mode === 'edit') {
            const rows = Array.isArray(salarySlip?.meta?.earnings)
                ? salarySlip.meta.earnings
                : [];
            if (rows.length > 0) {
                return rows.map((r: any) => ({
                    label: String(r?.label ?? ''),
                    amount: String(r?.amount ?? ''),
                }));
            }

            return [{ label: 'Basic', amount: '' }];
        }

        return [
            { label: 'Basic Pay', amount: '' },
            { label: 'Allowance', amount: '' },
        ];
    };

    const initialDeductions = (): AmountRow[] => {
        if (mode === 'edit') {
            const rows = Array.isArray(salarySlip?.meta?.deductions)
                ? salarySlip.meta.deductions
                : [];
            if (rows.length > 0) {
                return rows.map((r: any) => ({
                    label: String(r?.label ?? ''),
                    amount: String(r?.amount ?? ''),
                    tax_id: r?.tax_id ? String(r.tax_id) : '',
                }));
            }

            return [{ label: 'Tax', amount: '', tax_id: '' }];
        }

        return [{ label: 'Tax', amount: '', tax_id: '' }];
    };

    const initialPayslipExtra = (): LabelValueRow[] => {
        if (mode !== 'edit') {
            return [];
        }

        const rows = Array.isArray(salarySlip?.meta?.payslip_extra)
            ? salarySlip.meta.payslip_extra
            : [];
        return rows.map((r: any) => ({
            label: String(r?.label ?? ''),
            value: String(r?.value ?? ''),
        }));
    };

    const initialEmployeeExtra = (): LabelValueRow[] => {
        if (mode !== 'edit') {
            return [];
        }

        const rows = Array.isArray(salarySlip?.meta?.employee_extra)
            ? salarySlip.meta.employee_extra
            : [];
        return rows.map((r: any) => ({
            label: String(r?.label ?? ''),
            value: String(r?.value ?? ''),
        }));
    };

    const [payslipFields, setPayslipFields] = useState<KeyValueRow[]>(
        initialPayslipFields,
    );
    const [employeeFields, setEmployeeFields] = useState<KeyValueRow[]>(
        initialEmployeeFields,
    );
    const [earnings, setEarnings] = useState<AmountRow[]>(initialEarnings);
    const [deductions, setDeductions] = useState<AmountRow[]>(initialDeductions);
    const [payslipExtra, setPayslipExtra] = useState<LabelValueRow[]>(
        initialPayslipExtra,
    );
    const [employeeExtra, setEmployeeExtra] = useState<LabelValueRow[]>(
        initialEmployeeExtra,
    );

    const totalEarnings = earnings.reduce((sum, row) => {
        const n = Number.parseFloat(String(row.amount ?? ''));
        return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    const totalDeductions = deductions.reduce((sum, row) => {
        const n = Number.parseFloat(String(row.amount ?? ''));
        return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    const basicSalary = (() => {
        const match = earnings.find((e) =>
            String(e.label ?? '').toLowerCase().includes('basic'),
        );
        const amount = match?.amount ?? earnings[0]?.amount ?? '';
        const n = Number.parseFloat(String(amount));
        return Number.isFinite(n) ? n : 0;
    })();

    const allowanceAmount = Math.max(0, totalEarnings - basicSalary);
    const deductionAmount = totalDeductions;
    const netPayAmount = basicSalary + allowanceAmount - deductionAmount;

    const [showNetPayInWords, setShowNetPayInWords] = useState<boolean>(() => {
        const raw = (salarySlip as any)?.meta?.show_net_pay_in_words;
        if (raw === undefined || raw === null || raw === '') {
            return true;
        }
        if (raw === false || raw === 0 || raw === '0') {
            return false;
        }
        return true;
    });

    const [showEmployerSignatureInPdf, setShowEmployerSignatureInPdf] =
        useState<boolean>(() => {
            const raw = (salarySlip as any)?.meta?.show_employer_signature_in_pdf;
            if (raw === undefined || raw === null || raw === '') {
                const legacy = (salarySlip as any)?.meta?.show_signatures_in_pdf;
                if (legacy === undefined || legacy === null || legacy === '') {
                    return true;
                }
                if (legacy === false || legacy === 0 || legacy === '0') {
                    return false;
                }
                return true;
            }
            if (raw === false || raw === 0 || raw === '0') {
                return false;
            }
            return true;
        });

    const [showEmployeeSignatureInPdf, setShowEmployeeSignatureInPdf] =
        useState<boolean>(() => {
            const raw = (salarySlip as any)?.meta?.show_employee_signature_in_pdf;
            if (raw === undefined || raw === null || raw === '') {
                const legacy = (salarySlip as any)?.meta?.show_signatures_in_pdf;
                if (legacy === undefined || legacy === null || legacy === '') {
                    return true;
                }
                if (legacy === false || legacy === 0 || legacy === '0') {
                    return false;
                }
                return true;
            }
            if (raw === false || raw === 0 || raw === '0') {
                return false;
            }
            return true;
        });

    const numberToWords = (n: number): string => {
        const ones = [
            '',
            'One',
            'Two',
            'Three',
            'Four',
            'Five',
            'Six',
            'Seven',
            'Eight',
            'Nine',
            'Ten',
            'Eleven',
            'Twelve',
            'Thirteen',
            'Fourteen',
            'Fifteen',
            'Sixteen',
            'Seventeen',
            'Eighteen',
            'Nineteen',
        ];
        const tens = [
            '',
            '',
            'Twenty',
            'Thirty',
            'Forty',
            'Fifty',
            'Sixty',
            'Seventy',
            'Eighty',
            'Ninety',
        ];

        const toWordsBelow1000 = (x: number): string => {
            let out: string[] = [];
            const h = Math.floor(x / 100);
            const r = x % 100;
            if (h > 0) {
                out.push(`${ones[h]} Hundred`);
            }
            if (r > 0) {
                if (r < 20) {
                    out.push(ones[r]);
                } else {
                    const t = Math.floor(r / 10);
                    const u = r % 10;
                    out.push(u ? `${tens[t]} ${ones[u]}` : tens[t]);
                }
            }
            return out.join(' ').trim();
        };

        if (!Number.isFinite(n)) {
            return '';
        }

        n = Math.floor(Math.abs(n));
        if (n === 0) {
            return 'Zero';
        }

        const parts: string[] = [];
        const billions = Math.floor(n / 1_000_000_000);
        n = n % 1_000_000_000;
        const millions = Math.floor(n / 1_000_000);
        n = n % 1_000_000;
        const thousands = Math.floor(n / 1000);
        const rest = n % 1000;

        if (billions) parts.push(`${toWordsBelow1000(billions)} Billion`);
        if (millions) parts.push(`${toWordsBelow1000(millions)} Million`);
        if (thousands) parts.push(`${toWordsBelow1000(thousands)} Thousand`);
        if (rest) parts.push(toWordsBelow1000(rest));

        return parts.join(' ').replace(/\s+/g, ' ').trim();
    };

    const netPayInWords = (() => {
        const abs = Math.abs(netPayAmount);
        const rupees = Math.floor(abs + 1e-9);
        const paise = Math.round((abs - rupees) * 100);
        const rupeesWords = numberToWords(rupees);
        const paiseWords = paise > 0 ? numberToWords(paise) : '';
        const sign = netPayAmount < 0 ? 'Minus ' : '';
        const joined = paiseWords
            ? `${sign}${rupeesWords} and ${paiseWords} Paise Only`
            : `${sign}${rupeesWords} Only`;
        return joined.replace(/\s+/g, ' ').trim();
    })();

    const taxesById = useMemo(() => {
        const map = new Map<string, TaxRow>();
        (taxes ?? []).forEach((t) => map.set(String(t.id), t));
        return map;
    }, [taxes]);

    const taxLabelForDisplay = useCallback((tax: TaxRow) => {
        const name = String(tax?.name ?? '').trim();
        const type = String(tax?.type ?? '').trim();
        if (!name) {
            return '';
        }

        if (type === 'percentage') {
            const raw = Number(tax?.value);
            if (Number.isFinite(raw)) {
                const formatted = Number.isInteger(raw)
                    ? String(raw)
                    : String(raw).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
                return `${name} (${formatted}%)`;
            }
        }

        return name;
    }, []);

    const computeTaxAmount = useCallback(
        (tax: TaxRow | null) => {
            if (!tax) {
                return '';
            }

            const value = Number(tax.value);
            if (!Number.isFinite(value)) {
                return '';
            }

            const amount =
                String(tax.type) === 'percentage'
                    ? (totalEarnings * value) / 100
                    : value;

            if (!Number.isFinite(amount)) {
                return '';
            }

            return amount.toFixed(2);
        },
        [totalEarnings],
    );

    useEffect(() => {
        setDeductions((prev) => {
            let changed = false;

            const next = prev.map((row) => {
                if (!row.tax_id) {
                    return row;
                }

                const tax = taxesById.get(String(row.tax_id)) ?? null;
                if (!tax) {
                    return row;
                }

                const amount = computeTaxAmount(tax);
                const label = taxLabelForDisplay(tax) || row.label;

                if (row.amount !== amount || row.label !== label) {
                    changed = true;
                    return { ...row, amount, label };
                }

                return row;
            });

            return changed ? next : prev;
        });
    }, [computeTaxAmount, taxesById]);

    const getCanvasPointFromClient = (
        canvas: HTMLCanvasElement,
        clientX: number,
        clientY: number,
    ) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const drawLine = (
        canvas: HTMLCanvasElement,
        from: { x: number; y: number },
        to: { x: number; y: number },
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    };

    const clearCanvas = (canvas: HTMLCanvasElement | null) => {
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return (
        <Form
            id="salarySlipForm"
            method="post"
            action={action}
            className="space-y-8"
            encType="multipart/form-data"
        >
            {({ processing, errors }) => (
                <>
                    {mode === 'edit' && (
                        <input type="hidden" name="_method" value="PUT" />
                    )}

                    <input type="hidden" name="basic_salary" value={basicSalary} />
                    <input type="hidden" name="allowance_amount" value={allowanceAmount} />
                    <input type="hidden" name="deduction_amount" value={deductionAmount} />

                    <Card>
                        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-0.5">
                                <CardTitle>Salary Slip Details</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Configure the template and employer details for this payslip.
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="document_template_id">
                                            Template
                                        </Label>
                                        <Link
                                            href="/template/create"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-primary hover:underline hover:underline-offset-4"
                                        >
                                            Create one
                                        </Link>
                                    </div>
                                    <input
                                        type="hidden"
                                        name="document_template_id"
                                        value={documentTemplateId}
                                    />
                                    <Select
                                        value={documentTemplateId}
                                        onValueChange={(v) => setDocumentTemplateId(v)}
                                    >
                                        <SelectTrigger
                                            id="document_template_id"
                                            className="h-9 py-1 text-base md:text-sm"
                                        >
                                            <SelectValue placeholder="Select template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.map((t: any) => (
                                                <SelectItem
                                                    key={t.id}
                                                    value={String(t.id)}
                                                >
                                                    {t.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={(errors as any).document_template_id} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="meta_heading">Heading</Label>
                                    <Input
                                        id="meta_heading"
                                        name="meta[heading]"
                                        type="text"
                                        defaultValue={
                                            mode === 'edit'
                                                ? salarySlip?.meta?.heading ?? 'Payslip'
                                                : 'Payslip'
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="meta_company_name">Company name</Label>
                                    <Input
                                        id="meta_company_name"
                                        name="meta[company_name]"
                                        type="text"
                                        defaultValue={
                                            mode === 'edit'
                                                ? salarySlip?.meta?.company_name ?? ''
                                                : settingsDefaults?.company_name ?? ''
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="meta_company_address">
                                        Company address
                                    </Label>
                                    <textarea
                                        id="meta_company_address"
                                        name="meta[company_address]"
                                        defaultValue={
                                            mode === 'edit'
                                                ? salarySlip?.meta?.company_address ?? ''
                                                : settingsDefaults?.company_address ?? ''
                                        }
                                        rows={1}
                                        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm min-h-[4.5rem] resize-none"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Payslip Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {payslipFields.map((row, i) => (
                                    <div
                                        key={row.key}
                                        className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                                    >
                                        <input
                                            type="hidden"
                                            name={`meta[payslip_fields][${i}][key]`}
                                            value={row.key}
                                        />
                                        <div className="grid gap-1">
                                            <Label>Label</Label>
                                            <Input
                                                name={`meta[payslip_fields][${i}][label]`}
                                                value={row.label}
                                                required
                                                onChange={(e) => {
                                                    const next = [...payslipFields];
                                                    next[i] = {
                                                        ...next[i],
                                                        label: e.target.value,
                                                    };
                                                    setPayslipFields(next);
                                                }}
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <Label>Value</Label>
                                            {(() => {
                                                const isPayDateNative =
                                                    row.key === 'pay_date' &&
                                                    (row.value === '' ||
                                                        isIsoDate(row.value));

                                                return (
                                            <Input
                                                name={`meta[payslip_fields][${i}][value]`}
                                                type={
                                                    row.key === 'pay_date' &&
                                                    (row.value === '' || isIsoDate(row.value))
                                                        ? 'date'
                                                        : 'text'
                                                }
                                                value={
                                                    row.key === 'pay_date' &&
                                                    (row.value === '' || isIsoDate(row.value))
                                                        ? row.value || new Date().toISOString().slice(0, 10)
                                                        : row.value
                                                }
                                                required
                                                onClick={(e) => {
                                                    if (isPayDateNative) {
                                                        tryShowNativeDatePicker(
                                                            e.currentTarget,
                                                        );
                                                    }
                                                }}
                                                onFocus={(e) => {
                                                    if (isPayDateNative) {
                                                        tryShowNativeDatePicker(
                                                            e.currentTarget,
                                                        );
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const next = [...payslipFields];
                                                    next[i] = {
                                                        ...next[i],
                                                        value: e.target.value,
                                                    };
                                                    setPayslipFields(next);
                                                }}
                                            />
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-end justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setPayslipFields(
                                                        payslipFields.filter(
                                                            (_, idx) => idx !== i,
                                                        ),
                                                    );
                                                }}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full justify-center"
                                    onClick={() => {
                                        const used = new Set(
                                            payslipFields.map((r) => r.key),
                                        );
                                        setPayslipFields([
                                            ...payslipFields,
                                            {
                                                key: ensureUniqueKey(
                                                    'payslip_item',
                                                    used,
                                                ),
                                                label: '',
                                                value: '',
                                            },
                                        ]);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Item
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Employee Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {employeeFields.map((row, i) => (
                                    <div
                                        key={row.key}
                                        className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                                    >
                                        <input
                                            type="hidden"
                                            name={`meta[employee_fields][${i}][key]`}
                                            value={row.key}
                                        />
                                        <div className="grid gap-1">
                                            <Label>Label</Label>
                                            <Input
                                                name={`meta[employee_fields][${i}][label]`}
                                                value={row.label}
                                                required
                                                onChange={(e) => {
                                                    const next = [...employeeFields];
                                                    next[i] = {
                                                        ...next[i],
                                                        label: e.target.value,
                                                    };
                                                    setEmployeeFields(next);
                                                }}
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <Label>Value</Label>
                                            <Input
                                                name={`meta[employee_fields][${i}][value]`}
                                                value={row.value}
                                                required
                                                onChange={(e) => {
                                                    const next = [...employeeFields];
                                                    next[i] = {
                                                        ...next[i],
                                                        value: e.target.value,
                                                    };
                                                    setEmployeeFields(next);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-end justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setEmployeeFields(
                                                        employeeFields.filter(
                                                            (_, idx) => idx !== i,
                                                        ),
                                                    );
                                                }}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full justify-center"
                                    onClick={() => {
                                        const used = new Set(
                                            employeeFields.map((r) => r.key),
                                        );
                                        setEmployeeFields([
                                            ...employeeFields,
                                            {
                                                key: ensureUniqueKey(
                                                    'employee_item',
                                                    used,
                                                ),
                                                label: '',
                                                value: '',
                                            },
                                        ]);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Item
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-2">
                        <h2 className="text-base font-semibold tracking-tight">
                            Salary Details
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Earnings</CardTitle>
                                </CardHeader>
                                <CardContent
                                    className={
                                        mode === 'create'
                                            ? 'flex h-full flex-col gap-3'
                                            : 'space-y-3'
                                    }
                                >
                                    <div className="space-y-3">
                                        {earnings.map((row, i) => (
                                            <div
                                                key={i}
                                                className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                                            >
                                                <div className="grid gap-1">
                                                    <Label>Title</Label>
                                                    <Input
                                                        name={`meta[earnings][${i}][label]`}
                                                        value={row.label}
                                                        required
                                                        onChange={(e) => {
                                                            const next = [...earnings];
                                                            next[i] = {
                                                                ...next[i],
                                                                label: e.target.value,
                                                            };
                                                            setEarnings(next);
                                                        }}
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label>Amount</Label>
                                                    <Input
                                                        name={`meta[earnings][${i}][amount]`}
                                                        type="number"
                                                        step="0.01"
                                                        value={row.amount}
                                                        required
                                                        onChange={(e) => {
                                                            const next = [...earnings];
                                                            next[i] = {
                                                                ...next[i],
                                                                amount: e.target.value,
                                                            };
                                                            setEarnings(next);
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-end justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setEarnings(
                                                                earnings.filter(
                                                                    (_, idx) => idx !== i,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="w-full justify-center"
                                        onClick={() =>
                                            setEarnings([
                                                ...earnings,
                                                { label: '', amount: '' },
                                            ])
                                        }
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Item
                                    </Button>

                                    {mode === 'create' ? (
                                        <div className="mt-auto border-t pt-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    Total Earnings
                                                </span>
                                                <span className="font-medium">
                                                    {totalEarnings.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2 pt-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    Total Earnings
                                                </span>
                                                <span className="font-medium">
                                                    {totalEarnings.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Deductions</CardTitle>
                                </CardHeader>
                                <CardContent
                                    className={
                                        mode === 'create'
                                            ? 'flex h-full flex-col gap-3'
                                            : 'space-y-3'
                                    }
                                >
                                    <div className="space-y-3">
                                        {deductions.map((row, i) => (
                                            <div
                                                key={i}
                                                className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                                            >
                                                <div className="grid gap-1">
                                                    <Label>Tax</Label>
                                                    <input
                                                        type="hidden"
                                                        name={`meta[deductions][${i}][tax_id]`}
                                                        value={row.tax_id ?? ''}
                                                    />
                                                    <Select
                                                        value={
                                                            row.tax_id
                                                                ? String(row.tax_id)
                                                                : '__custom__'
                                                        }
                                                        onValueChange={(value) => {
                                                            const next = [...deductions];

                                                            if (value === '__custom__') {
                                                                next[i] = {
                                                                    ...next[i],
                                                                    tax_id: '',
                                                                };
                                                                setDeductions(next);
                                                                return;
                                                            }

                                                            const tax =
                                                                taxesById.get(String(value)) ??
                                                                null;
                                                            next[i] = {
                                                                ...next[i],
                                                                tax_id: value,
                                                                label: tax
                                                                    ? taxLabelForDisplay(tax)
                                                                    : next[i].label,
                                                                amount: computeTaxAmount(tax),
                                                            };

                                                            setDeductions(next);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10">
                                                            <SelectValue placeholder="Custom" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__custom__">
                                                                Custom
                                                            </SelectItem>
                                                            {(taxes ?? []).map((t) => (
                                                                <SelectItem
                                                                    key={t.id}
                                                                    value={String(t.id)}
                                                                >
                                                                    {taxLabelForDisplay(t)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label>Title</Label>
                                                    <Input
                                                        name={`meta[deductions][${i}][label]`}
                                                        value={row.label}
                                                        readOnly={!!row.tax_id}
                                                        required
                                                        onChange={(e) => {
                                                            const next = [...deductions];
                                                            next[i] = {
                                                                ...next[i],
                                                                label: e.target.value,
                                                            };
                                                            setDeductions(next);
                                                        }}
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label>Amount</Label>
                                                    <Input
                                                        name={`meta[deductions][${i}][amount]`}
                                                        type="number"
                                                        step="0.01"
                                                        value={row.amount}
                                                        readOnly={!!row.tax_id}
                                                        required
                                                        onChange={(e) => {
                                                            const next = [...deductions];
                                                            next[i] = {
                                                                ...next[i],
                                                                amount: e.target.value,
                                                            };
                                                            setDeductions(next);
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-end justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setDeductions(
                                                                deductions.filter(
                                                                    (_, idx) => idx !== i,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="w-full justify-center"
                                        onClick={() =>
                                            setDeductions([
                                                ...deductions,
                                                { label: '', amount: '', tax_id: '' },
                                            ])
                                        }
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Item
                                    </Button>

                                    {mode === 'create' ? (
                                        <div className="mt-auto border-t pt-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    Total Deductions
                                                </span>
                                                <span className="font-medium">
                                                    {totalDeductions.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2 pt-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    Total Deductions
                                                </span>
                                                <span className="font-medium">
                                                    {totalDeductions.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="md:col-span-2">
                                <CardContent className="space-y-3 py-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <div className="text-sm text-muted-foreground">
                                                Net Pay
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Total earnings minus deductions
                                            </div>
                                        </div>
                                        <div className="text-lg font-semibold tabular-nums">
                                            {netPayAmount.toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                                        <Label htmlFor="meta_net_pay_in_words">
                                            Net pay in words
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="show_net_pay_in_words"
                                                checked={showNetPayInWords}
                                                onCheckedChange={(v) =>
                                                    setShowNetPayInWords(v === true)
                                                }
                                            />
                                            <Label
                                                htmlFor="show_net_pay_in_words"
                                                className="text-sm font-normal"
                                            >
                                                Show in PDF
                                            </Label>
                                        </div>
                                    </div>

                                    <input
                                        type="hidden"
                                        name="meta[show_net_pay_in_words]"
                                        value={showNetPayInWords ? '1' : '0'}
                                    />

                                    <input
                                        type="hidden"
                                        name="meta[net_pay_in_words]"
                                        value={netPayInWords}
                                    />

                                    {showNetPayInWords ? (
                                        <textarea
                                            id="meta_net_pay_in_words"
                                            value={netPayInWords}
                                            readOnly
                                            rows={2}
                                            className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground min-h-[2.25rem] w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                        />
                                    ) : null}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-base">
                                        Employer signature
                                    </CardTitle>
                                    <ToggleGroup
                                        type="single"
                                        value={employerSignatureMode}
                                        onValueChange={(value) => {
                                            if (!value) {
                                                return;
                                            }
                                            const nextMode = value as 'draw' | 'upload';
                                            setEmployerSignatureMode(nextMode);
                                            if (nextMode === 'draw') {
                                                setEmployerSignatureFileKey((k) => k + 1);
                                            }
                                            if (nextMode === 'upload') {
                                                clearCanvas(employerCanvasRef.current);
                                            }
                                        }}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <ToggleGroupItem value="draw">Pad</ToggleGroupItem>
                                        <ToggleGroupItem value="upload">Upload</ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="show_employer_signature_in_pdf">
                                        Employer signature
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="show_employer_signature_in_pdf"
                                            checked={showEmployerSignatureInPdf}
                                            onCheckedChange={(v) =>
                                                setShowEmployerSignatureInPdf(v === true)
                                            }
                                        />
                                        <Label
                                            htmlFor="show_employer_signature_in_pdf"
                                            className="text-sm font-normal"
                                        >
                                            Show in PDF
                                        </Label>
                                    </div>
                                </div>

                                <input
                                    type="hidden"
                                    name="meta[show_employer_signature_in_pdf]"
                                    value={showEmployerSignatureInPdf ? '1' : '0'}
                                />

                                <input
                                    type="hidden"
                                    name="meta[employer_signature]"
                                    value={employerSignature}
                                />

                                {mode === 'edit' && employerSignature ? (
                                    <img
                                        src={signaturePreviewSrc(employerSignature)}
                                        alt="Employer signature"
                                        className="h-16 w-full rounded-md border border-sidebar-border/70 bg-white object-contain"
                                    />
                                ) : null}

                                {employerSignatureMode === 'upload' ? (
                                    <>
                                        <Input
                                            key={employerSignatureFileKey}
                                            name="employer_signature_file"
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            onChange={(e) => {
                                                const file = e.currentTarget.files?.[0] ?? null;
                                                const message = validateSignatureFile(file);
                                                setEmployerSignatureFileError(message);
                                                if (message) {
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                        {employerSignatureFileError ? (
                                            <InputError message={employerSignatureFileError} />
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <canvas
                                            ref={employerCanvasRef}
                                            width={640}
                                            height={240}
                                            className="h-32 w-full touch-none select-none rounded-md border border-sidebar-border/70 bg-white"
                                            onPointerDown={(e) => {
                                                e.preventDefault();
                                                const canvas = employerCanvasRef.current;
                                                if (!canvas) {
                                                    return;
                                                }

                                                employerIsDrawingRef.current = true;
                                                employerLastPointRef.current =
                                                    getCanvasPointFromClient(
                                                        canvas,
                                                        e.clientX,
                                                        e.clientY,
                                                    );
                                                canvas.setPointerCapture(e.pointerId);
                                            }}
                                            onPointerMove={(e) => {
                                                e.preventDefault();
                                                const canvas = employerCanvasRef.current;
                                                if (!canvas) {
                                                    return;
                                                }
                                                if (!employerIsDrawingRef.current) {
                                                    return;
                                                }

                                                const last = employerLastPointRef.current;
                                                if (!last) {
                                                    return;
                                                }

                                                const nativeEvent: any = e.nativeEvent as any;
                                                const events: any[] =
                                                    typeof nativeEvent.getCoalescedEvents ===
                                                    'function'
                                                        ? nativeEvent.getCoalescedEvents()
                                                        : [nativeEvent];

                                                for (const ev of events) {
                                                    const nextPoint =
                                                        getCanvasPointFromClient(
                                                            canvas,
                                                            ev.clientX,
                                                            ev.clientY,
                                                        );
                                                    drawLine(canvas, employerLastPointRef.current ?? last, nextPoint);
                                                    employerLastPointRef.current = nextPoint;
                                                }
                                            }}
                                            onPointerUp={() => {
                                                const canvas = employerCanvasRef.current;
                                                employerIsDrawingRef.current = false;
                                                employerLastPointRef.current = null;
                                                if (!canvas) {
                                                    return;
                                                }
                                                setEmployerSignature(
                                                    canvas.toDataURL('image/png'),
                                                );
                                            }}
                                            onPointerLeave={() => {
                                                employerIsDrawingRef.current = false;
                                                employerLastPointRef.current = null;
                                            }}
                                            onPointerCancel={() => {
                                                employerIsDrawingRef.current = false;
                                                employerLastPointRef.current = null;
                                            }}
                                        />
                                        <div className="flex items-center justify-between">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    clearCanvas(employerCanvasRef.current);
                                                    setEmployerSignature('');
                                                }}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-base">
                                        Employee signature
                                    </CardTitle>
                                    <ToggleGroup
                                        type="single"
                                        value={employeeSignatureMode}
                                        onValueChange={(value) => {
                                            if (!value) {
                                                return;
                                            }
                                            const nextMode = value as 'draw' | 'upload';
                                            setEmployeeSignatureMode(nextMode);
                                            if (nextMode === 'draw') {
                                                setEmployeeSignatureFileKey((k) => k + 1);
                                            }
                                            if (nextMode === 'upload') {
                                                clearCanvas(employeeCanvasRef.current);
                                            }
                                        }}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <ToggleGroupItem value="draw">Pad</ToggleGroupItem>
                                        <ToggleGroupItem value="upload">Upload</ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="show_employee_signature_in_pdf">
                                        Employee signature
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="show_employee_signature_in_pdf"
                                            checked={showEmployeeSignatureInPdf}
                                            onCheckedChange={(v) =>
                                                setShowEmployeeSignatureInPdf(v === true)
                                            }
                                        />
                                        <Label
                                            htmlFor="show_employee_signature_in_pdf"
                                            className="text-sm font-normal"
                                        >
                                            Show in PDF
                                        </Label>
                                    </div>
                                </div>

                                <input
                                    type="hidden"
                                    name="meta[show_employee_signature_in_pdf]"
                                    value={showEmployeeSignatureInPdf ? '1' : '0'}
                                />

                                <input
                                    type="hidden"
                                    name="meta[employee_signature]"
                                    value={employeeSignature}
                                />

                                {mode === 'edit' && employeeSignature ? (
                                    <img
                                        src={signaturePreviewSrc(employeeSignature)}
                                        alt="Employee signature"
                                        className="h-16 w-full rounded-md border border-sidebar-border/70 bg-white object-contain"
                                    />
                                ) : null}

                                {employeeSignatureMode === 'upload' ? (
                                    <>
                                        <Input
                                            key={employeeSignatureFileKey}
                                            name="employee_signature_file"
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            onChange={(e) => {
                                                const file = e.currentTarget.files?.[0] ?? null;
                                                const message = validateSignatureFile(file);
                                                setEmployeeSignatureFileError(message);
                                                if (message) {
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                        {employeeSignatureFileError ? (
                                            <InputError message={employeeSignatureFileError} />
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <canvas
                                            ref={employeeCanvasRef}
                                            width={640}
                                            height={240}
                                            className="h-32 w-full touch-none select-none rounded-md border border-sidebar-border/70 bg-white"
                                            onPointerDown={(e) => {
                                                e.preventDefault();
                                                const canvas = employeeCanvasRef.current;
                                                if (!canvas) {
                                                    return;
                                                }

                                                employeeIsDrawingRef.current = true;
                                                employeeLastPointRef.current =
                                                    getCanvasPointFromClient(
                                                        canvas,
                                                        e.clientX,
                                                        e.clientY,
                                                    );
                                                canvas.setPointerCapture(e.pointerId);
                                            }}
                                            onPointerMove={(e) => {
                                                e.preventDefault();
                                                const canvas = employeeCanvasRef.current;
                                                if (!canvas) {
                                                    return;
                                                }
                                                if (!employeeIsDrawingRef.current) {
                                                    return;
                                                }

                                                const last = employeeLastPointRef.current;
                                                if (!last) {
                                                    return;
                                                }

                                                const nativeEvent: any = e.nativeEvent as any;
                                                const events: any[] =
                                                    typeof nativeEvent.getCoalescedEvents ===
                                                    'function'
                                                        ? nativeEvent.getCoalescedEvents()
                                                        : [nativeEvent];

                                                for (const ev of events) {
                                                    const nextPoint =
                                                        getCanvasPointFromClient(
                                                            canvas,
                                                            ev.clientX,
                                                            ev.clientY,
                                                        );
                                                    drawLine(canvas, employeeLastPointRef.current ?? last, nextPoint);
                                                    employeeLastPointRef.current = nextPoint;
                                                }
                                            }}
                                            onPointerUp={() => {
                                                const canvas = employeeCanvasRef.current;
                                                employeeIsDrawingRef.current = false;
                                                employeeLastPointRef.current = null;
                                                if (!canvas) {
                                                    return;
                                                }
                                                setEmployeeSignature(
                                                    canvas.toDataURL('image/png'),
                                                );
                                            }}
                                            onPointerLeave={() => {
                                                employeeIsDrawingRef.current = false;
                                                employeeLastPointRef.current = null;
                                            }}
                                            onPointerCancel={() => {
                                                employeeIsDrawingRef.current = false;
                                                employeeLastPointRef.current = null;
                                            }}
                                        />
                                        <div className="flex items-center justify-between">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    clearCanvas(employeeCanvasRef.current);
                                                    setEmployeeSignature('');
                                                }}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="submit" disabled={processing}>
                            Save
                        </Button>
                    </div>

                </>
            )}
        </Form>
    );
}
