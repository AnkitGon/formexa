import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type TabId = 'brand' | 'system' | 'invoice';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Settings',
        href: '/settings',
    },
];

export default function SettingsIndex({
    brand,
    settings,
    currencies = [],
}: {
    brand?: {
        logo_dark_url?: string | null;
        logo_light_url?: string | null;
        favicon_url?: string | null;
        invoice_logo_url?: string | null;
    };
    settings?: Record<string, string | null>;
    currencies?: Array<{ value: string; label: string }>;
}) {
    const allowedExtensions = useMemo(
        () => new Set(['jpg', 'jpeg', 'png', 'svg', 'webp']),
        [],
    );
    const allowedMimes = useMemo(
        () =>
            new Set([
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/svg+xml',
                'image/webp',
            ]),
        [],
    );

    const currencyOptions = useMemo(
        () => (currencies ?? []).filter((c): c is { value: string; label: string } => !!c?.value && !!c?.label),
        [currencies],
    );

    const tabs = useMemo(
        () =>
            [
                {
                    id: 'brand' as const,
                    title: 'Brand',
                    description: 'Upload logos and favicon',
                },
                {
                    id: 'system' as const,
                    title: 'System',
                    description: 'Defaults and localization preferences',
                },
                {
                    id: 'invoice' as const,
                    title: 'Invoice',
                    description: 'Numbering and identity',
                },
            ] satisfies Array<{ id: TabId; title: string; description: string }>,
        [],
    );

    const [activeTab, setActiveTab] = useState<TabId>('brand');
    const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

    const [brandFiles, setBrandFiles] = useState<{
        logoDark: File | null;
        logoLight: File | null;
        favicon: File | null;
    }>({
        logoDark: null,
        logoLight: null,
        favicon: null,
    });
    const [brandErrors, setBrandErrors] = useState<{
        logoDark?: string;
        logoLight?: string;
        favicon?: string;
        companyName?: string;
        companyAddress?: string;
        form?: string;
    }>({});

    const [isSavingBrand, setIsSavingBrand] = useState(false);

    const [companyName, setCompanyName] = useState<string>(
        (settings?.company_name as string | null) ?? '',
    );
    const [companyAddress, setCompanyAddress] = useState<string>(
        (settings?.company_address as string | null) ?? '',
    );

    const [dateFormat, setDateFormat] = useState<string>(
        (settings?.date_format as string | null) ?? 'YYYY-MM-DD',
    );
    const [timeFormat, setTimeFormat] = useState<string>(
        (settings?.time_format as string | null) ?? 'hh:mm A',
    );
    const [defaultCurrency, setDefaultCurrency] = useState<string>(
        (settings?.default_currency as string | null) ?? '',
    );
    const [currencySymbolPosition, setCurrencySymbolPosition] = useState<string>(
        (settings?.currency_symbol_position as string | null) ?? 'prefix',
    );
    const [systemErrors, setSystemErrors] = useState<Record<string, string | undefined>>({});
    const [isSavingSystem, setIsSavingSystem] = useState(false);

    const [invoicePrefix, setInvoicePrefix] = useState<string>(
        (settings?.invoice_prefix as string | null) ?? 'INV-',
    );
    const [invoiceSeries, setInvoiceSeries] = useState<string>(
        (settings?.invoice_series as string | null) ?? new Date().getFullYear().toString(),
    );
    const [invoiceLogo, setInvoiceLogo] = useState<File | null>(null);
    const [invoiceLogoError, setInvoiceLogoError] = useState<string | undefined>();
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState<string>(
        (settings?.invoice_discount_mode as string | null) ?? 'none',
    );
    const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string | undefined>>({});
    const [isSavingInvoice, setIsSavingInvoice] = useState(false);

    const logoDarkRef = useRef<HTMLInputElement | null>(null);
    const logoLightRef = useRef<HTMLInputElement | null>(null);
    const faviconRef = useRef<HTMLInputElement | null>(null);
    const invoiceLogoInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setDateFormat((settings?.date_format as string | null) ?? 'YYYY-MM-DD');
        setTimeFormat((settings?.time_format as string | null) ?? 'hh:mm A');
        const fallbackCurrency = currencyOptions[0]?.value ?? '';
        setDefaultCurrency((settings?.default_currency as string | null) ?? fallbackCurrency);
        setCurrencySymbolPosition(
            (settings?.currency_symbol_position as string | null) ?? 'prefix',
        );
        setInvoicePrefix((settings?.invoice_prefix as string | null) ?? 'INV-');
        setInvoiceSeries(
            (settings?.invoice_series as string | null) ?? new Date().getFullYear().toString(),
        );
    }, [
        settings?.date_format,
        settings?.time_format,
        settings?.default_currency,
        settings?.currency_symbol_position,
        currencyOptions,
        settings?.invoice_prefix,
        settings?.invoice_prefix,
        settings?.invoice_series,
        settings?.invoice_discount_mode,
    ]);

    useEffect(() => {
        setDateFormat((settings?.date_format as string | null) ?? 'YYYY-MM-DD');
        setTimeFormat((settings?.time_format as string | null) ?? 'hh:mm A');
        const fallbackCurrency = currencyOptions[0]?.value ?? '';
        setDefaultCurrency((settings?.default_currency as string | null) ?? fallbackCurrency);
        setCurrencySymbolPosition(
            (settings?.currency_symbol_position as string | null) ?? 'prefix',
        );
        setInvoicePrefix((settings?.invoice_prefix as string | null) ?? 'INV-');
        setInvoiceSeries(
            (settings?.invoice_series as string | null) ?? new Date().getFullYear().toString(),
        );
        setInvoiceDiscountMode((settings?.invoice_discount_mode as string | null) ?? 'none');
    }, [
        settings?.date_format,
        settings?.time_format,
        settings?.default_currency,
        settings?.currency_symbol_position,
        currencyOptions,
        settings?.invoice_prefix,
        settings?.invoice_series,
        settings?.invoice_discount_mode,
    ]);

    const validateImageFile = (file: File | null): string | null => {
        if (!file) {
            return null;
        }

        const ext = (file.name.split('.').pop() ?? '').toLowerCase();
        const mime = (file.type ?? '').toLowerCase();
        const ok = allowedExtensions.has(ext) || allowedMimes.has(mime);
        if (!ok) {
            return 'Only image files are allowed (jpg, jpeg, png, svg, webp).';
        }
        return null;
    };

    const BrandUploadCard = ({
        title,
        description,
        hint,
        file,
        existingUrl,
        error,
        inputRef,
        onPick,
    }: {
        title: string;
        description: string;
        hint: string;
        file: File | null;
        existingUrl?: string | null;
        error?: string;
        inputRef: React.RefObject<HTMLInputElement | null>;
        onPick: (file: File | null) => void;
    }) => {
        const [previewUrl, setPreviewUrl] = useState<string | null>(null);
        const [isDragging, setIsDragging] = useState(false);

        useEffect(() => {
            if (!file) {
                setPreviewUrl(existingUrl ?? null);
                return;
            }

            const isSvg =
                file.type === 'image/svg+xml' ||
                file.name.toLowerCase().endsWith('.svg');
            if (isSvg) {
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        setPreviewUrl(reader.result);
                    }
                };
                reader.readAsDataURL(file);
                return;
            }

            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        }, [file, existingUrl]);

        const hasAsset = Boolean(file || existingUrl);

        return (
            <Card className="gap-0 h-full overflow-hidden border-sidebar-border/60 transition-shadow hover:shadow-sm">
                <CardHeader className="border-b border-sidebar-border/60 bg-muted/10 pb-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <CardTitle className="text-sm">{title}</CardTitle>
                            <CardDescription className="mt-1">
                                {description}
                            </CardDescription>
                        </div>

                        <div className="text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-4">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const next = e.dataTransfer.files?.[0] ?? null;
                            onPick(next);
                            if (inputRef.current) {
                                inputRef.current.value = '';
                            }
                        }}
                        className={cn(
                            'group relative flex min-h-[96px] w-full items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                            error
                                ? 'border-destructive/60 bg-destructive/5'
                                : isDragging
                                    ? 'border-primary/70 bg-primary/5'
                                    : 'border-sidebar-border/70 bg-muted/10 hover:border-primary/30 hover:bg-muted/20',
                        )}
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <div
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border bg-background shadow-sm',
                                    error
                                        ? 'border-destructive/40'
                                        : 'border-sidebar-border/60 group-hover:border-primary/30',
                                )}
                            >
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt={title}
                                        className="h-full w-full object-contain p-1"
                                    />
                                ) : (
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>

                            <div className="min-w-0">
                                <div className="text-sm font-medium">
                                    {hasAsset ? 'Replace file' : 'Upload file'}
                                </div>
                                <div className="mt-0.5 text-xs leading-4 text-muted-foreground">
                                    <div>Drag and drop, or click to browse.</div>
                                    <div className="mt-1 truncate">{hint}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="rounded-md border border-sidebar-border/60 bg-background p-2 text-muted-foreground shadow-sm transition-colors group-hover:text-foreground">
                                <Upload className="h-4 w-4" />
                            </div>
                        </div>
                    </button>

                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.svg,.webp,image/jpeg,image/png,image/svg+xml,image/webp"
                        onChange={(e) => {
                            const next = e.target.files?.[0] ?? null;
                            onPick(next);
                            e.currentTarget.value = '';
                        }}
                    />

                    {file && (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-sidebar-border/60 bg-muted/20 px-3 py-2">
                            <div className="min-w-0">
                                <div className="truncate text-sm">{file.name}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(0)} KB
                                    {' · '}
                                    {(file.type || 'image').replace('image/', '').toUpperCase()}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    if (inputRef.current) {
                                        inputRef.current.value = '';
                                    }
                                    onPick(null);
                                }}
                            >
                                <X className="h-4 w-4" />
                                Remove
                            </Button>
                        </div>
                    )}

                    {previewUrl && (
                        <div className="overflow-hidden rounded-lg border border-sidebar-border/60 bg-muted/20">
                            <div className="flex items-center justify-center p-4" style={{ backgroundColor: 'rgb(249, 249, 249)' }}>
                                <img
                                    src={previewUrl}
                                    alt={title}
                                    className="max-h-28 w-auto max-w-full object-contain"
                                />
                            </div>
                        </div>
                    )}

                    <InputError message={error} />
                </CardContent>
            </Card>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Settings" />

            <div className="flex flex-col gap-6 p-4">
                <div>
                    <h1 className="text-lg font-semibold">Settings</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Configure your application preferences
                    </p>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row">
                    <aside className="w-full lg:w-72">
                        <Card className="gap-0 py-4">
                            <CardContent className="px-2">
                                <nav className="flex flex-col space-y-1">
                                    {tabs.map((tab) => {
                                        const isActive = tab.id === activeTab;
                                        return (
                                            <Button
                                                key={tab.id}
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setActiveTab(tab.id)}
                                                className={cn(
                                                    'w-full justify-start gap-2 rounded-md border-l-2 px-3 py-2 text-sm font-medium',
                                                    isActive
                                                        ? 'border-primary bg-muted text-foreground'
                                                        : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                                )}
                                            >
                                                <span>{tab.title}</span>
                                            </Button>
                                        );
                                    })}
                                </nav>
                            </CardContent>
                        </Card>
                    </aside>

                    <Separator className="lg:hidden" />

                    <div className="min-w-0 flex-1">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    {active.title}
                                </CardTitle>
                                <CardDescription>
                                    {active.description}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                <Separator />

                                {activeTab === 'brand' && (
                                    <form
                                        className="space-y-6"
                                        onSubmit={(e) => {
                                            e.preventDefault();

                                            const nextErrors: typeof brandErrors = {};
                                            const darkErr = validateImageFile(brandFiles.logoDark);
                                            const lightErr = validateImageFile(brandFiles.logoLight);
                                            const favErr = validateImageFile(brandFiles.favicon);
                                            if (darkErr) nextErrors.logoDark = darkErr;
                                            if (lightErr) nextErrors.logoLight = lightErr;
                                            if (favErr) nextErrors.favicon = favErr;

                                            if (Object.keys(nextErrors).length > 0) {
                                                setBrandErrors(nextErrors);
                                                return;
                                            }

                                            setBrandErrors(nextErrors);

                                            router.post(
                                                '/settings/brand',
                                                {
                                                    logo_dark: brandFiles.logoDark,
                                                    logo_light: brandFiles.logoLight,
                                                    favicon: brandFiles.favicon,
                                                    company_name: companyName,
                                                    company_address: companyAddress,
                                                },
                                                {
                                                    preserveScroll: true,
                                                    forceFormData: true,
                                                    onStart: () => setIsSavingBrand(true),
                                                    onFinish: () => setIsSavingBrand(false),
                                                    onSuccess: () => {
                                                        setBrandFiles({
                                                            logoDark: null,
                                                            logoLight: null,
                                                            favicon: null,
                                                        });
                                                        setBrandErrors({});
                                                    },
                                                    onError: (errors) => {
                                                        setBrandErrors({
                                                            logoDark: (errors as any).logo_dark,
                                                            logoLight: (errors as any).logo_light,
                                                            favicon: (errors as any).favicon,
                                                            companyName: (errors as any).company_name,
                                                            companyAddress: (errors as any).company_address,
                                                            form: (errors as any).form,
                                                        });
                                                    },
                                                },
                                            );
                                        }}
                                    >

                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <BrandUploadCard
                                                title="Logo (Dark)"
                                                description="Used on light backgrounds"
                                                hint="Recommended: SVG or PNG · JPG/WEBP also ok"
                                                file={brandFiles.logoDark}
                                                existingUrl={brand?.logo_dark_url ?? null}
                                                error={brandErrors.logoDark}
                                                inputRef={logoDarkRef}
                                                onPick={(file) => {
                                                    const err = validateImageFile(file);
                                                    setBrandFiles((prev) => ({
                                                        ...prev,
                                                        logoDark: err ? null : file,
                                                    }));
                                                    setBrandErrors((prev) => ({
                                                        ...prev,
                                                        logoDark: err ?? undefined,
                                                    }));
                                                }}
                                            />

                                            <BrandUploadCard
                                                title="Logo (Light)"
                                                description="Used on dark backgrounds"
                                                hint="Recommended: SVG or PNG · JPG/WEBP also ok"
                                                file={brandFiles.logoLight}
                                                existingUrl={brand?.logo_light_url ?? null}
                                                error={brandErrors.logoLight}
                                                inputRef={logoLightRef}
                                                onPick={(file) => {
                                                    const err = validateImageFile(file);
                                                    setBrandFiles((prev) => ({
                                                        ...prev,
                                                        logoLight: err ? null : file,
                                                    }));
                                                    setBrandErrors((prev) => ({
                                                        ...prev,
                                                        logoLight: err ?? undefined,
                                                    }));
                                                }}
                                            />

                                            <BrandUploadCard
                                                title="Favicon"
                                                description="Shown in browser tab"
                                                hint="Square image recommended · SVG/PNG preferred"
                                                file={brandFiles.favicon}
                                                existingUrl={brand?.favicon_url ?? null}
                                                error={brandErrors.favicon}
                                                inputRef={faviconRef}
                                                onPick={(file) => {
                                                    const err = validateImageFile(file);
                                                    setBrandFiles((prev) => ({
                                                        ...prev,
                                                        favicon: err ? null : file,
                                                    }));
                                                    setBrandErrors((prev) => ({
                                                        ...prev,
                                                        favicon: err ?? undefined,
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <div className="space-y-2 lg:col-span-1">
                                                <Label htmlFor="company_name">
                                                    Company Name
                                                </Label>
                                                <Input
                                                    id="company_name"
                                                    value={companyName}
                                                    onChange={(e) => setCompanyName(e.target.value)}
                                                    placeholder="Company name"
                                                    autoComplete="organization"
                                                />
                                                <InputError message={brandErrors.companyName} />
                                            </div>

                                            <div className="space-y-2 lg:col-span-2">
                                                <Label htmlFor="company_address">
                                                    Company Address
                                                </Label>
                                                <textarea
                                                    id="company_address"
                                                    value={companyAddress}
                                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                                    placeholder="Address"
                                                    rows={2}
                                                    className={cn(
                                                        'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
                                                        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                                                        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                                                        'min-h-[4.5rem] resize-none',
                                                    )}
                                                />
                                                <InputError message={brandErrors.companyAddress} />
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={isSavingBrand}>
                                                Save
                                            </Button>
                                        </div>
                                    </form>
                                )}

                                {activeTab === 'system' && (
                                    <form
                                        className="space-y-6"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            setSystemErrors({});
                                            router.post(
                                                '/settings',
                                                {
                                                    date_format: dateFormat,
                                                    time_format: timeFormat,
                                                    default_currency: defaultCurrency,
                                                    currency_symbol_position: currencySymbolPosition,
                                                },
                                                {
                                                    preserveScroll: true,
                                                    onStart: () => setIsSavingSystem(true),
                                                    onFinish: () => setIsSavingSystem(false),
                                                    onError: (errors) => {
                                                        setSystemErrors(errors as Record<string, string>);
                                                    },
                                                },
                                            );
                                        }}
                                    >
                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="date_format">Date format</Label>
                                                <Select
                                                    value={dateFormat}
                                                    onValueChange={setDateFormat}
                                                >
                                                    <SelectTrigger id="date_format">
                                                        <SelectValue placeholder="Select date format" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={systemErrors.date_format} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="time_format">Time format</Label>
                                                <Select
                                                    value={timeFormat}
                                                    onValueChange={setTimeFormat}
                                                >
                                                    <SelectTrigger id="time_format">
                                                        <SelectValue placeholder="Select time format" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="hh:mm A">12-hour (e.g., 02:30 PM)</SelectItem>
                                                        <SelectItem value="HH:mm">24-hour (e.g., 14:30)</SelectItem>
                                                        <SelectItem value="HH:mm:ss">24-hour with seconds</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={systemErrors.time_format} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="default_currency">Default currency</Label>
                                                <Select
                                                    value={defaultCurrency}
                                                    onValueChange={setDefaultCurrency}
                                                >
                                                    <SelectTrigger id="default_currency">
                                                        <SelectValue placeholder="Select currency" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {currencyOptions.map((currency: { value: string; label: string }) => (
                                                            <SelectItem key={currency.value} value={currency.value}>
                                                                {currency.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={systemErrors.default_currency} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="currency_symbol_position">
                                                    Currency symbol position
                                                </Label>
                                                <Select
                                                    value={currencySymbolPosition}
                                                    onValueChange={setCurrencySymbolPosition}
                                                >
                                                    <SelectTrigger id="currency_symbol_position">
                                                        <SelectValue placeholder="Select position" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="prefix">Prefix (e.g., $100)</SelectItem>
                                                        <SelectItem value="suffix">Suffix (e.g., 100€)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={systemErrors.currency_symbol_position} />
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={isSavingSystem}>
                                                Save
                                            </Button>
                                        </div>
                                    </form>
                                )}

                                {activeTab === 'invoice' && (
                                    <form
                                        className="space-y-6"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            setInvoiceErrors({});
                                            router.post(
                                                '/settings',
                                                {
                                                    invoice_prefix: invoicePrefix,
                                                    invoice_series: invoiceSeries,
                                                    invoice_logo: invoiceLogo,
                                                    invoice_discount_mode: invoiceDiscountMode,
                                                },
                                                {
                                                    preserveScroll: true,
                                                    forceFormData: true,
                                                    onStart: () => setIsSavingInvoice(true),
                                                    onFinish: () => setIsSavingInvoice(false),
                                                    onSuccess: () => {
                                                        setInvoiceLogo(null);
                                                        setInvoiceLogoError(undefined);
                                                    },
                                                    onError: (errors) => {
                                                        setInvoiceErrors(errors as Record<string, string>);
                                                    },
                                                },
                                            );
                                        }}
                                    >
                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <div className="space-y-2 lg:col-span-2">
                                                <Label className="flex items-center justify-between">
                                                    <span>Invoice logo</span>
                                                    <span className="text-xs text-muted-foreground">Shown on all invoices</span>
                                                </Label>
                                                <div className={cn(
                                                    'flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors',
                                                    invoiceLogoError
                                                        ? 'border-destructive/60 bg-destructive/5'
                                                        : 'border-sidebar-border/60 bg-muted/20 hover:border-primary/40'
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-12 w-12 rounded-md border border-sidebar-border/60 bg-background shadow-sm overflow-hidden">
                                                            {invoiceLogo ? (
                                                                <img
                                                                    src={URL.createObjectURL(invoiceLogo)}
                                                                    alt="Invoice logo preview"
                                                                    className="h-full w-full object-contain p-1"
                                                                />
                                                            ) : brand?.invoice_logo_url ? (
                                                                <img
                                                                    src={brand.invoice_logo_url}
                                                                    alt="Current invoice logo"
                                                                    className="h-full w-full object-contain p-1"
                                                                />
                                                            ) : (
                                                                <ImageIcon className="h-5 w-5 m-auto text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1 text-sm">
                                                            <div className="font-medium">Upload logo</div>
                                                            <p className="text-xs text-muted-foreground">
                                                                This logo will be used across all invoices.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {invoiceLogo && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setInvoiceLogo(null);
                                                                    setInvoiceLogoError(undefined);
                                                                }}
                                                            >
                                                                <X className="h-4 w-4 mr-1" />
                                                                Clear
                                                            </Button>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => invoiceLogoInputRef.current?.click()}
                                                        >
                                                            Choose file
                                                        </Button>
                                                    </div>
                                                </div>
                                                <input
                                                    ref={invoiceLogoInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept=".jpg,.jpeg,.png,.svg,.webp,image/jpeg,image/png,image/svg+xml,image/webp"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0] ?? null;
                                                        const err = validateImageFile(file);
                                                        if (err) {
                                                            setInvoiceLogo(null);
                                                            setInvoiceLogoError(err);
                                                        } else {
                                                            setInvoiceLogo(file);
                                                            setInvoiceLogoError(undefined);
                                                        }
                                                        e.currentTarget.value = '';
                                                    }}
                                                />
                                                <InputError message={invoiceLogoError} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="invoice_prefix">Invoice prefix / series</Label>
                                                <Input
                                                    id="invoice_prefix"
                                                    value={invoicePrefix}
                                                    onChange={(e) => setInvoicePrefix(e.target.value)}
                                                    placeholder="INV-"
                                                    className="font-mono"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Prefix shown before the series (e.g., INV-).
                                                </p>
                                                <InputError message={invoiceErrors.invoice_prefix} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="invoice_series">Series</Label>
                                                <Input
                                                    id="invoice_series"
                                                    value={invoiceSeries}
                                                    onChange={(e) => setInvoiceSeries(e.target.value)}
                                                    placeholder={new Date().getFullYear().toString()}
                                                    className="font-mono"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Commonly a year or business unit (e.g., 2025).
                                                </p>
                                                <InputError message={invoiceErrors.invoice_series} />
                                            </div>

                                            <div className="space-y-2 lg:col-span-2">
                                                <Label htmlFor="invoice_discount_mode">Discount Mode</Label>
                                                <Select
                                                    value={invoiceDiscountMode}
                                                    onValueChange={setInvoiceDiscountMode}
                                                >
                                                    <SelectTrigger id="invoice_discount_mode">
                                                        <SelectValue placeholder="Select discount mode" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        <SelectItem value="item">Per Item</SelectItem>
                                                        <SelectItem value="invoice">Invoice Level</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                    Default discount behavior for new invoices.
                                                </p>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={isSavingInvoice}>
                                                Save
                                            </Button>
                                        </div>
                                    </form>
                                )}

                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
