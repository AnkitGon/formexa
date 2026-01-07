import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { ChangeEvent, FormEventHandler, useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/use-toast';

// Textarea fallback
// Textarea fallback
const Textarea = (props: any) => <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y" {...props} />;

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import axios from 'axios';
import { Toggle } from '@/components/ui/toggle';
import { AlertTriangle } from 'lucide-react';

declare var route: any; // Fix route error

interface Client {
    id: number;
    name: string;
    company_name: string | null;
    email?: string | null;
    address?: string | null;
    tax_id?: string | null;
    phone?: string | null;
}

interface Tax {
    id: number;
    name: string;
    type: 'fixed' | 'percentage';
    value: number;
}

interface Template {
    id: number;
    name?: string;
    code: string;
}

interface InvoiceProps {
    invoice?: any;
    clients: Client[];
    nextNumber?: string;
    today?: string;
    taxes?: Tax[];
    templates?: Template[];
    business_settings?: {
        default_currency?: string | null;
        currency_symbol_position?: string | null;
        invoice_discount_mode?: 'none' | 'item' | 'invoice' | null;
    };
}

interface InvoiceFormData {
    client_id: string | number;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    status: string;
    notes: string;
    invoice_template_id?: string | number | null;
    discount_mode: 'none' | 'item' | 'invoice';
    discount_type: 'fixed' | 'percent';
    discount_value: number;
    items: any[]; // We will refine items type in normalizeItems or similar
}

const toDateInput = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value.slice(0, 10);
    return d.toISOString().slice(0, 10);
};

type InvoiceFormState = InvoiceFormData & {
    currency: string;
    currency_symbol_position: 'prefix' | 'suffix';
};

export default function Create({
    invoice,
    clients,
    nextNumber,
    today,
    taxes = [],
    templates = [],
    business_settings,
}: InvoiceProps) {
    const isEditing = !!invoice;
    const autoInvoiceNumber = invoice?.invoice_number || nextNumber || '';

    const normalizeItems = (items: any[] | undefined) => {
        const incoming = items && items.length ? items : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_type: 'percent', tax_id: null, discount_type: 'fixed', discount_value: 0 }];
        return incoming.map((it: any) => {
            const taxType = it.tax_type === 'fixed' ? 'fixed' : 'percent';
            const taxRate = it.tax_rate ?? 0;
            let taxId = it.tax_id ?? null;

            if ((taxId === null || taxId === undefined) && taxes.length) {
                const match = taxes.find(t => {
                    const tType = t.type === 'fixed' ? 'fixed' : 'percent';
                    return tType === taxType && Number(t.value ?? 0) === Number(taxRate ?? 0);
                });
                if (match) {
                    taxId = match.id;
                }
            }

            return {
                ...it,
                tax_type: taxType,
                tax_id: taxId,
                tax_rate: taxRate,
                discount_type: it.discount_type || 'fixed',
                discount_value: Number(it.discount_value || 0),
            };
        }) as any[];
    };

    const currencyOptions = useMemo(
        () => [
            { value: 'USD', label: 'USD – US Dollar', symbol: '$' },
            { value: 'EUR', label: 'EUR – Euro', symbol: '€' },
            { value: 'GBP', label: 'GBP – British Pound', symbol: '£' },
            { value: 'INR', label: 'INR – Indian Rupee', symbol: '₹' },
        ],
        [],
    );

    const defaultCurrencyFromSettings = invoice?.currency || business_settings?.default_currency || 'USD';
    const defaultSymbolPosition =
        (business_settings?.currency_symbol_position as string | null) === 'suffix' ? 'suffix' : 'prefix';

    const { data, setData, post, put, processing, errors, clearErrors, setError } = useForm<InvoiceFormState>({
        client_id: invoice?.client_id || '',
        invoice_number: invoice?.invoice_number || nextNumber || '',
        invoice_date: toDateInput(invoice?.invoice_date || today || ''),
        due_date: toDateInput(invoice?.due_date || ''),
        status: invoice?.status || 'draft',
        notes: invoice?.notes || '',
        invoice_template_id: invoice?.invoice_template_id || null,
        items: normalizeItems(invoice?.items),
        currency: defaultCurrencyFromSettings,
        currency_symbol_position: defaultSymbolPosition,
        discount_mode: (invoice?.discount_mode as any) || (business_settings?.invoice_discount_mode as any) || 'none',
        discount_type: (invoice?.discount_type as any) || 'fixed',
        discount_value: Number(invoice?.discount_value || 0),
    });

    const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
    const [allowManualInvoiceNumber, setAllowManualInvoiceNumber] = useState<boolean>(false);
    const [paymentTerms, setPaymentTerms] = useState<string>('due_on_receipt');
    const [clientList, setClientList] = useState<Client[]>(clients);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
        invoice?.invoice_template_id ? String(invoice.invoice_template_id) : undefined
    );
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);

    // Quick Client Creation State
    const [newClientData, setNewClientData] = useState({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
    });
    const [isCreatingClient, setIsCreatingClient] = useState(false);

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingClient(true);
        try {
            const response = await axios.post('/clients', newClientData, {
                headers: { Accept: 'application/json' },
            });

            const rawClient = response.data?.id ? response.data : response.data?.data ?? response.data?.client ?? response.data;
            if (!rawClient?.id) {
                throw new Error('Client created but response missing id.');
            }
            const normalizedClient = { ...rawClient, id: Number(rawClient.id) };
            setClientList((prev) => [normalizedClient, ...prev.filter((c) => String(c.id) !== String(normalizedClient.id))]);
            const idStr = String(normalizedClient.id);
            setData('client_id', idStr);
            clearErrors('client_id');
            setSelectedClient(normalizedClient);
            setIsClientModalOpen(false);
            setNewClientData({ name: '', company_name: '', email: '', phone: '', address: '', notes: '' });
            toast({
                title: 'Success!',
                description: `${normalizedClient.name || 'Client'} created successfully.`,
                status: 'success',
            });
        } catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                const message =
                    error.response?.data?.message ||
                    (typeof error.response?.data === 'string' ? error.response.data : null) ||
                    'Failed to create client. Please check fields.';
                toast({
                    title: 'Error!',
                    description: message,
                    status: 'error',
                });
            } else {
                toast({
                    title: 'Error!',
                    description: 'Failed to create client. Please check fields.',
                    status: 'error',
                });
            }
        } finally {
            setIsCreatingClient(false);
        }
    };

    const getItemError = (index: number, field: string) => {
        const key = `items.${index}.${field}` as keyof typeof errors;
        const raw = errors[key] as string | undefined;
        if (!raw) return undefined;
        if (field === 'description') return 'Description is required';
        if (field === 'quantity') return 'Quantity is required';
        if (field === 'unit_price') return 'Price is required';
        return raw;
    };

    // ...
    useEffect(() => {
        let sub = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        // 1. Calculate Subtotal first (needed for invoice level discount)
        data.items.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            sub += qty * price;
        });

        // 2. Calculate Invoice Level Discount
        let invoiceDiscountAmount = 0;
        if (data.discount_mode === 'invoice') {
            const dVal = Number(data.discount_value) || 0;
            if (data.discount_type === 'percent') {
                invoiceDiscountAmount = sub * (dVal / 100);
            } else {
                invoiceDiscountAmount = dVal;
            }
            if (invoiceDiscountAmount > sub) invoiceDiscountAmount = sub;
            totalDiscount = invoiceDiscountAmount;
        }

        // 3. Calculate Item taxes and Item discounts
        data.items.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            const rate = Number(item.tax_rate) || 0;
            const taxType = item.tax_type === 'fixed' ? 'fixed' : 'percent';

            const baseAmount = qty * price;
            let itemDiscount = 0;

            if (data.discount_mode === 'item') {
                const dVal = Number(item.discount_value) || 0;
                const dType = item.discount_type === 'percent' ? 'percent' : 'fixed';
                if (dType === 'percent') {
                    itemDiscount = baseAmount * (dVal / 100);
                } else {
                    itemDiscount = dVal;
                }
                if (itemDiscount > baseAmount) itemDiscount = baseAmount;
                totalDiscount += itemDiscount;
            } else if (data.discount_mode === 'invoice') {
                // Prorate for tax basis if needed
                if (sub > 0) {
                    itemDiscount = (baseAmount / sub) * invoiceDiscountAmount;
                }
            }

            const taxableAmount = baseAmount - itemDiscount;

            let itemTax = 0;
            if (taxType === 'percent') {
                itemTax = taxableAmount * (rate / 100);
            } else {
                // Fixed tax per unit 
                itemTax = qty * rate;
            }

            totalTax += itemTax;
        });

        setTotals({
            subtotal: sub,
            tax: totalTax,
            total: sub - totalDiscount + totalTax
        });
    }, [data.items, data.discount_mode, data.discount_type, data.discount_value]);

    // Update selected client when client_id changes
    useEffect(() => {
        const idStr = data.client_id ? String(data.client_id) : '';
        if (!idStr) {
            setSelectedClient(null);
            return;
        }
        const client = clientList.find((c) => String(c.id) === idStr);
        if (client) {
            setSelectedClient(client);
        } else if (!selectedClient || String(selectedClient.id) !== idStr) {
            setSelectedClient(null);
        }
    }, [data.client_id, clientList, selectedClient]);

    // If selectedClient exists but data.client_id was cleared, re-sync it.
    useEffect(() => {
        if (selectedClient && !data.client_id) {
            const idStr = String(selectedClient.id);
            setData('client_id', idStr);
            clearErrors('client_id');
        }
    }, [selectedClient, data.client_id]);

    // Update local list if props change (e.g. after reload)
    useEffect(() => {
        setClientList((prev) => {
            const incoming = clients.map((c) => ({ ...c, id: Number(c.id) }));
            const merged = [...prev];
            incoming.forEach((c) => {
                const idx = merged.findIndex((m) => String(m.id) === String(c.id));
                if (idx >= 0) {
                    merged[idx] = c;
                } else {
                    merged.push(c);
                }
            });
            return merged;
        });
    }, [clients]);

    const addItem = () => {
        setData('items', [
            ...data.items,
            { description: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_type: 'percent', tax_id: null, discount_type: 'fixed', discount_value: 0 }
        ]);
    };

    const removeItem = (index: number) => {
        const newItems = [...data.items];
        newItems.splice(index, 1);
        setData('items', newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setData('items', newItems);
    };

    const paymentTermsOptions = useMemo(
        () => [
            { value: 'due_on_receipt', label: 'Due on receipt', days: 0 },
            { value: 'net_7', label: 'Net 7', days: 7 },
            { value: 'net_15', label: 'Net 15', days: 15 },
            { value: 'net_30', label: 'Net 30', days: 30 },
            { value: 'custom', label: 'Custom', days: null },
        ],
        [],
    );

    useEffect(() => {
        if (!allowManualInvoiceNumber) {
            setData('invoice_number', autoInvoiceNumber);
        }
    }, [allowManualInvoiceNumber, autoInvoiceNumber, setData]);

    const computeDueDate = (issued: string, terms: string) => {
        const option = paymentTermsOptions.find((o) => o.value === terms);
        if (!option || option.days === null) return null;
        if (!issued) return '';
        const issuedDate = new Date(issued);
        if (Number.isNaN(issuedDate.getTime())) return '';
        const due = new Date(issuedDate);
        due.setDate(due.getDate() + option.days);
        return due.toISOString().slice(0, 10);
    };

    useEffect(() => {
        const nextDue = computeDueDate(data.invoice_date, paymentTerms);
        if (nextDue !== null) {
            setData('due_date', nextDue);
        }
    }, [data.invoice_date, paymentTerms, setData]);

    const formatMoney = (amount: number) => {
        const symbol = currencyOptions.find((c) => c.value === data.currency)?.symbol ?? '$';
        const fixed = amount.toFixed(2);
        return data.currency_symbol_position === 'suffix'
            ? `${fixed}${symbol}`
            : `${symbol}${fixed}`;
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        const clientId = data.client_id || selectedClient?.id;
        if (!clientId) {
            clearErrors();
            setError('client_id', 'Client is required');
            toast({
                title: 'Error',
                description: 'Please select or create a client before saving.',
                status: 'error',
            });
            return;
        }

        if (!data.invoice_template_id) {
            clearErrors();
            setError('invoice_template_id', 'Template is required');
            toast({
                title: 'Error',
                description: 'Please select a template.',
                status: 'error',
            });
            return;
        }

        if (!data.items || !data.items.length) {
            clearErrors();
            setError('items', 'At least one item is required');
            toast({
                title: 'Error',
                description: 'Add at least one item.',
                status: 'error',
            });
            return;
        }

        const clientIdStr = String(clientId);
        setData('client_id', clientIdStr);
        clearErrors('client_id');
        if (isEditing) {
            put(`/invoices/${invoice.id}`);
        } else {
            post('/invoices');
        }
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Invoices', href: '/invoices' },
            { title: isEditing ? 'Edit' : 'Create', href: '' }
        ]}>
            <Head title={isEditing ? 'Edit Invoice' : 'New Invoice'} />

            <div className="p-4">
                <div className="w-full max-w-6xl mx-auto overflow-y-auto bg-background p-4 lg:p-6 custom-scrollbar">
                    <div className="space-y-6 pb-20">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Invoice' : 'New Invoice'}</h1>
                                <p className="text-muted-foreground">Manage invoice details</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                                    Cancel
                                </Button>
                            </div>
                        </div>

                        <form onSubmit={submit} className="space-y-8">

                            {/* Section: Basic Info */}
                            <div className="grid gap-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                    Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label>Template</Label>
                                            <Link
                                                href="/template/create"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-medium text-primary hover:underline hover:underline-offset-4"
                                            >
                                                Create one
                                            </Link>
                                        </div>
                                        <Select
                                            value={selectedTemplate}
                                            onValueChange={(val) => {
                                                setSelectedTemplate(val === 'none' ? undefined : val);
                                                setData('invoice_template_id', val === 'none' ? null : val);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates && templates.length ? (
                                                    templates.map((tpl: Template) => (
                                                        <SelectItem key={tpl.id} value={String(tpl.id)}>
                                                            {tpl.name || tpl.code}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <SelectItem value="none">Select Template</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {errors.invoice_template_id && <p className="text-sm text-red-500">{errors.invoice_template_id}</p>}
                                    </div>
                                    <div className="space-y-3">
                                        <Label>Client</Label>
                                        <div className="flex gap-2">
                                            <Select
                                                value={
                                                    data.client_id
                                                        ? String(data.client_id)
                                                        : selectedClient
                                                            ? String(selectedClient.id)
                                                            : undefined
                                                }
                                                onValueChange={(val) => {
                                                    setData('client_id', val);
                                                    clearErrors('client_id');
                                                    const match = clientList.find((c) => String(c.id) === String(val));
                                                    setSelectedClient(match ?? null);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Client" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {clientList.map(client => (
                                                        <SelectItem key={client.id} value={String(client.id)}>
                                                            {client.company_name || client.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
                                                <DialogTrigger asChild>
                                                    <Button type="button" variant="outline" size="icon" title="Add new client">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent
                                                    onOpenAutoFocus={(event) => {
                                                        event.preventDefault();
                                                    }}
                                                >
                                                    <DialogHeader>
                                                        <DialogTitle>Add New Client</DialogTitle>
                                                        <DialogDescription>Create a new client record instantly.</DialogDescription>
                                                    </DialogHeader>
                                                    <form
                                                        onSubmit={(e: React.FormEvent) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleCreateClient(e);
                                                        }}
                                                        className="space-y-4 pt-4"
                                                    >
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Name *</Label>
                                                                <Input
                                                                    required
                                                                    value={newClientData.name}
                                                                    onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Company Name</Label>
                                                                <Input
                                                                    value={newClientData.company_name}
                                                                    onChange={e => setNewClientData({ ...newClientData, company_name: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Email</Label>
                                                            <Input
                                                                type="email"
                                                                value={newClientData.email}
                                                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                                    setNewClientData({ ...newClientData, email: e.target.value })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Phone</Label>
                                                                <Input
                                                                    value={newClientData.phone}
                                                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                                        setNewClientData({ ...newClientData, phone: e.target.value })
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Address</Label>
                                                                <Input
                                                                    value={newClientData.address}
                                                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                                        setNewClientData({ ...newClientData, address: e.target.value })
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Notes</Label>
                                                            <Textarea
                                                                value={newClientData.notes}
                                                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                                                                    setNewClientData({ ...newClientData, notes: e.target.value })
                                                                }
                                                                rows={3}
                                                            />
                                                        </div>
                                                        <DialogFooter>
                                                            <Button type="submit" disabled={isCreatingClient}>
                                                                {isCreatingClient ? 'Saving...' : 'Save'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </form>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        {errors.client_id && <p className="text-sm text-red-500">{errors.client_id}</p>}
                                        {selectedClient && (
                                            <div className="rounded-md border border-sidebar-border/60 bg-muted/30 p-3 text-sm space-y-1">
                                                <div className="font-semibold text-foreground">
                                                    {selectedClient.company_name || selectedClient.name}
                                                </div>
                                                <div className="text-muted-foreground">{selectedClient.name}</div>
                                                {selectedClient.email && (
                                                    <div className="text-muted-foreground">{selectedClient.email}</div>
                                                )}
                                                {selectedClient.phone && (
                                                    <div className="text-muted-foreground">{selectedClient.phone}</div>
                                                )}
                                                {selectedClient.address && (
                                                    <div className="text-muted-foreground">Address: {selectedClient.address}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-sidebar-border/60 bg-muted/20 p-4 space-y-4">
                                    <div className="text-sm font-medium text-muted-foreground">Invoice metadata</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <Label className="m-0">Invoice #</Label>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-muted-foreground text-xs">Auto-generate</span>
                                                    <Toggle
                                                        pressed={!allowManualInvoiceNumber}
                                                        onPressedChange={(pressed) => {
                                                            const isAuto = pressed;
                                                            setAllowManualInvoiceNumber(!isAuto);
                                                            if (isAuto) {
                                                                setData('invoice_number', autoInvoiceNumber);
                                                            }
                                                        }}
                                                        aria-label="Toggle auto invoice number"
                                                        className="h-6 w-12 rounded-full bg-muted/70 px-1 data-[state=on]:bg-primary/80"
                                                    >
                                                        <span
                                                            className={`h-4 w-4 rounded-full bg-background shadow transition-transform ${!allowManualInvoiceNumber ? 'translate-x-5' : 'translate-x-0'}`}
                                                        />
                                                    </Toggle>
                                                    <span className="text-muted-foreground text-xs">Manual</span>
                                                </div>
                                            </div>

                                            <Input
                                                value={data.invoice_number}
                                                onChange={e => setData('invoice_number', e.target.value)}
                                                readOnly={!allowManualInvoiceNumber}
                                                className={`font-mono ${!allowManualInvoiceNumber ? 'bg-muted cursor-not-allowed opacity-80' : ''}`}
                                                placeholder={autoInvoiceNumber || 'INV-YYYY-0001'}
                                                aria-describedby="invoice-number-helper"
                                            />
                                            {!allowManualInvoiceNumber ? (
                                                <p className="text-xs text-muted-foreground">
                                                    Auto-generated numbers follow a continuous legal sequence.
                                                </p>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="flex items-start gap-2 text-xs text-amber-600">
                                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                        <p>Manual invoice numbers may break legal or accounting sequence.</p>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        You’re responsible for ensuring invoice number uniqueness.
                                                    </p>
                                                </div>
                                            )}
                                            {errors.invoice_number && (
                                                <p className="text-sm text-red-500">{errors.invoice_number}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select
                                                value={data.status}
                                                onValueChange={(val) => setData('status', val)}
                                                disabled={!isEditing}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="draft">Draft</SelectItem>
                                                    <SelectItem value="sent">Sent</SelectItem>
                                                    <SelectItem value="paid">Paid</SelectItem>
                                                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                                    <SelectItem value="overdue">Overdue</SelectItem>
                                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {!isEditing && (
                                                <p className="text-xs text-muted-foreground">Status starts as Draft when creating.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Issued Date</Label>
                                            <Input
                                                type="date"
                                                value={data.invoice_date}
                                                onChange={e => setData('invoice_date', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Payment Terms</Label>
                                            <Select
                                                value={paymentTerms}
                                                onValueChange={(val) => setPaymentTerms(val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select terms" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {paymentTermsOptions.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Due Date</Label>
                                            <Input
                                                type="date"
                                                value={data.due_date}
                                                readOnly={paymentTerms !== 'custom'}
                                                onChange={e => {
                                                    const next = e.target.value;
                                                    // If user edits while on non-custom terms, switch to custom
                                                    if (paymentTerms !== 'custom') {
                                                        setPaymentTerms('custom');
                                                    }
                                                    setData('due_date', next);
                                                }}
                                                className={paymentTerms !== 'custom' ? 'bg-muted cursor-not-allowed opacity-80' : ''}
                                            />
                                            {paymentTerms !== 'custom' && (
                                                <p className="text-xs text-muted-foreground">
                                                    Calculated from issued date and terms.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />



                            <Separator />

                            {/* Section: Items */}
                            <div className="grid gap-4">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                            Items
                                        </h3>
                                        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="text-primary hover:text-primary/80">
                                            <Plus className="mr-2 h-4 w-4" /> Add Item
                                        </Button>
                                    </div>
                                    {errors.items && (
                                        <p className="text-sm text-red-500">{errors.items as any}</p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {data.items.map((item, index) => {
                                        const qty = Number(item.quantity) || 0;
                                        const price = Number(item.unit_price) || 0;
                                        const rate = Number(item.tax_rate || 0);
                                        const taxType = item.tax_type === 'fixed' ? 'fixed' : 'percent';

                                        const baseAmount = qty * price;
                                        let itemDiscount = 0;
                                        if (data.discount_mode === 'item') {
                                            const dVal = Number(item.discount_value) || 0;
                                            const dType = item.discount_type === 'percent' ? 'percent' : 'fixed';
                                            if (dType === 'percent') {
                                                itemDiscount = baseAmount * (dVal / 100);
                                            } else {
                                                itemDiscount = dVal;
                                            }
                                            if (itemDiscount > baseAmount) itemDiscount = baseAmount;
                                        } else if (data.discount_mode === 'invoice') {
                                            // We just show pro-rated or nothing? The req says "Item-level discounts must be disabled in this mode".
                                            // So we don't show inputs.
                                        }

                                        const taxableAmount = baseAmount - itemDiscount;
                                        const itemTax = taxType === 'percent' ? taxableAmount * (rate / 100) : qty * rate;
                                        const totalWithTax = baseAmount - itemDiscount + itemTax; // Line total usually includes tax

                                        const showItemDiscount = data.discount_mode === 'item';

                                        return (
                                            <div
                                                key={index}
                                                className="group relative grid grid-cols-12 gap-3 items-center p-3 rounded-lg border bg-card/60 hover:bg-card hover:shadow-sm transition-all"
                                            >
                                                <div className={`col-span-12 ${showItemDiscount ? 'md:col-span-3' : 'md:col-span-4'} min-w-0`}>
                                                    <Label className="text-xs text-muted-foreground">Description</Label>
                                                    <Input
                                                        value={item.description}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'description', e.target.value)}
                                                        placeholder="Description"
                                                        className="h-10 font-medium w-full"
                                                    />
                                                    {getItemError(index, 'description') && (
                                                        <p className="text-xs text-red-500">{getItemError(index, 'description')}</p>
                                                    )}
                                                </div>
                                                <div className={`col-span-6 ${showItemDiscount ? 'md:col-span-1' : 'md:col-span-2'}`}>
                                                    <Label className="text-xs text-muted-foreground">Qty</Label>
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'quantity', e.target.value)}
                                                        className="h-10 text-right w-full"
                                                        placeholder="Qty"
                                                    />
                                                    {getItemError(index, 'quantity') && (
                                                        <p className="text-xs text-red-500">{getItemError(index, 'quantity')}</p>
                                                    )}
                                                </div>
                                                <div className="col-span-6 md:col-span-2">
                                                    <Label className="text-xs text-muted-foreground">Price</Label>
                                                    <Input
                                                        type="number"
                                                        value={item.unit_price}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'unit_price', e.target.value)}
                                                        className="h-10 text-right w-full"
                                                        placeholder="Price"
                                                    />
                                                    {getItemError(index, 'unit_price') && (
                                                        <p className="text-xs text-red-500">{getItemError(index, 'unit_price')}</p>
                                                    )}
                                                </div>

                                                {showItemDiscount && (
                                                    <div className="col-span-6 md:col-span-2">
                                                        <Label className="text-xs text-muted-foreground">Discount</Label>
                                                        <div className="flex gap-1">
                                                            <Input
                                                                type="number"
                                                                value={item.discount_value}
                                                                onChange={(e) => updateItem(index, 'discount_value', e.target.value)}
                                                                className="h-10 text-right w-full"
                                                                placeholder="0"
                                                            />
                                                            <Select
                                                                value={item.discount_type || 'fixed'}
                                                                onValueChange={(val) => updateItem(index, 'discount_type', val)}
                                                            >
                                                                <SelectTrigger className="h-10 w-[70px] px-1 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="fixed">Fixed</SelectItem>
                                                                    <SelectItem value="percent">%</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="col-span-6 md:col-span-2">
                                                    <Label className="text-xs text-muted-foreground">Tax</Label>
                                                    <Select
                                                        value={
                                                            item.tax_id !== null && item.tax_id !== undefined
                                                                ? String(item.tax_id)
                                                                : 'none'
                                                        }
                                                        onValueChange={(val) => {
                                                            const newItems = [...data.items];
                                                            if (val === 'none') {
                                                                newItems[index] = { ...newItems[index], tax_id: null, tax_type: 'percent', tax_rate: 0 };
                                                                setData('items', newItems);
                                                                return;
                                                            }
                                                            const picked = taxes.find(t => String(t.id) === val);
                                                            if (picked) {
                                                                newItems[index] = {
                                                                    ...newItems[index],
                                                                    tax_id: picked.id,
                                                                    tax_type: picked.type === 'fixed' ? 'fixed' : 'percent',
                                                                    tax_rate: picked.value,
                                                                };
                                                                setData('items', newItems);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10 w-full">
                                                            <SelectValue placeholder="Select tax" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Select Tax</SelectItem>
                                                            {taxes.map(t => {
                                                                const val = Number(t.value ?? 0).toFixed(2);
                                                                const label = t.type === 'fixed'
                                                                    ? `${t.name} (Fixed ${val})`
                                                                    : `${t.name} (% ${val})`;
                                                                return (
                                                                    <SelectItem key={t.id} value={String(t.id)}>
                                                                        {label}
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-6 md:col-span-1 flex flex-col justify-center md:items-end">
                                                    <Label className="text-xs text-muted-foreground">Total</Label>
                                                    <div className="h-10 w-full md:w-24 flex items-center justify-end font-semibold text-sm px-2">
                                                        {totalWithTax.toFixed(2)}
                                                    </div>
                                                </div>
                                                <div className="col-span-12 md:col-span-1 flex justify-end items-center self-center">
                                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeItem(index)} disabled={data.items.length === 1}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 md:justify-end md:items-end px-4 text-sm font-medium min-w-[300px] ml-auto">
                                <div className="flex justify-between items-center w-full md:w-64">
                                    <span className="text-muted-foreground">Subtotal:</span>
                                    <span className="text-foreground ml-2">{formatMoney(totals.subtotal)}</span>
                                </div>

                                {/* Invoice Level Discount */}
                                {(data.discount_mode === 'invoice' || totals.subtotal > totals.total + totals.tax) && (
                                    <div className="flex justify-between items-center w-full md:w-64 text-rose-600">
                                        <div className="flex items-center gap-2">
                                            <span>Discount</span>
                                            {data.discount_mode === 'invoice' && (
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        value={data.discount_value}
                                                        onChange={(e) => setData('discount_value', Number(e.target.value))}
                                                        className="h-7 w-20 text-right text-xs"
                                                        placeholder="0"
                                                    />
                                                    <Select
                                                        value={data.discount_type}
                                                        onValueChange={(val: 'fixed' | 'percent') => setData('discount_type', val)}
                                                    >
                                                        <SelectTrigger className="h-7 w-[50px] px-1 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="fixed">$</SelectItem>
                                                            <SelectItem value="percent">%</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                        <span className="ml-2">
                                            - {formatMoney(Number(totals.subtotal) - (Number(totals.total) - Number(totals.tax)))}
                                        </span>
                                    </div>
                                )}

                                {data.discount_mode === 'item' && (Number(totals.subtotal) > (Number(totals.total) - Number(totals.tax))) && (
                                    <div className="flex justify-between items-center w-full md:w-64 text-rose-600">
                                        <span className="text-muted-foreground text-rose-600">Total Discount:</span>
                                        <span className="ml-2">- {formatMoney(Number(totals.subtotal) - (Number(totals.total) - Number(totals.tax)))}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center w-full md:w-64">
                                    <span className="text-muted-foreground">Tax:</span>
                                    <span className="text-foreground ml-2">{formatMoney(totals.tax)}</span>
                                </div>
                                <div className="flex justify-between items-center w-full md:w-64 text-lg font-bold border-t pt-2 mt-1 border-dashed">
                                    <span>Total:</span>
                                    <span className="text-primary ml-2">{formatMoney(totals.total)}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Section: Notes */}
                            <div className="grid gap-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                    Notes
                                </h3>
                                <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Textarea
                                        value={data.notes}
                                        onChange={(e: any) => setData('notes', e.target.value)}
                                        placeholder="Additional notes for the client..."
                                        rows={4}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="submit" disabled={processing}>
                                        {isEditing ? 'Save' : 'Save Draft'}
                                    </Button>
                                </div>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </AppLayout >
    );
}
