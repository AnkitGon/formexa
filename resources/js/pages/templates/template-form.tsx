import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Form } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const getCsrfToken = () =>
    (
        document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
    )?.content ?? '';

const getCookieValue = (name: string) => {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
        const [key, ...rest] = cookie.split('=');
        if (key === name) {
            return decodeURIComponent(rest.join('='));
        }
    }
    return '';
};

type TemplateFormValues = {
    id?: number;
    name?: string;
    code?: string;
    description?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    font_family?: string;
    font_size?: number | string;
    line_height?: number | string;
    is_active?: boolean;
    document_type?: string;
};

type Props = {
    mode: 'create' | 'edit';
    action: string;
    designOptions: Record<string, string>;
    template?: TemplateFormValues;
};

export default function SalarySlipTemplateForm({
    mode,
    action,
    designOptions,
    template,
}: Props) {
    const DEFAULT_FONT = 'default';
    const csrfToken = getCsrfToken();

    const triggerFormChange = () => {
        const form = document.getElementById('templateForm');
        form?.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const normalizeColor = (value: unknown, fallback: string) => {
        if (typeof value !== 'string') {
            return fallback;
        }

        const v = value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            return v;
        }

        if (/^#[0-9a-fA-F]{8}$/.test(v)) {
            return v.slice(0, 7);
        }

        return fallback;
    };

    const invoiceDesignOptions: Record<string, string> = {
        business: 'Business',
        retail: 'Retail',
        service: 'Service',
        'tax-invoice': 'Tax Invoice',
    };

    const resolveDesignOptions = (docType: string) =>
        docType === 'invoice' ? invoiceDesignOptions : designOptions ?? {};

    const getDefaultDesign = (docType: string, opts: Record<string, string>) => {
        const entries =
            docType === 'invoice'
                ? Object.keys(invoiceDesignOptions)
                : Object.keys(opts ?? {});
        return entries.length ? entries[0] : docType === 'invoice' ? 'business' : 'classic';
    };

    const [previewHtml, setPreviewHtml] = useState('');
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [documentType, setDocumentType] = useState<string>(
        mode === 'create'
            ? 'salary_slip'
            : String(template?.document_type ?? 'salary_slip'),
    );
    const [designCode, setDesignCode] = useState<string>(
        mode === 'create'
            ? getDefaultDesign(
                  mode === 'create'
                      ? 'salary_slip'
                      : String(template?.document_type ?? 'salary_slip'),
                  resolveDesignOptions(
                      mode === 'create'
                          ? 'salary_slip'
                          : String(template?.document_type ?? 'salary_slip'),
                  ),
              )
            : String(
                  template?.code ??
                      getDefaultDesign(
                          String(template?.document_type ?? 'salary_slip'),
                          resolveDesignOptions(
                              String(template?.document_type ?? 'salary_slip'),
                          ),
                      ),
              ),
    );
    const [fontFamily, setFontFamily] = useState<string>(
        template?.font_family ?? DEFAULT_FONT,
    );
    const [primaryColor, setPrimaryColor] = useState<string>(
        normalizeColor(template?.primary_color, '#95979b'),
    );
    const [accentColor, setAccentColor] = useState<string>(
        normalizeColor(template?.accent_color, '#111827'),
    );
    const [secondaryColor, setSecondaryColor] = useState<string>(
        normalizeColor(template?.secondary_color, '#111827'),
    );
    const previewTimeoutRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Ensure design aligns with current module and defaults to first option on change
    useEffect(() => {
        const opts = resolveDesignOptions(documentType);
        const next = getDefaultDesign(documentType, opts);
        if (designCode !== next) {
            setDesignCode(next);
            triggerFormChange();
        }
    }, [documentType]);

    const designOptionsForModule = resolveDesignOptions(documentType);
    const selectedDesignCode =
        designCode && designOptionsForModule[designCode]
            ? designCode
            : getDefaultDesign(documentType, designOptionsForModule);

    useEffect(() => {
        if (designCode !== selectedDesignCode) {
            setDesignCode(selectedDesignCode);
        }
    }, [selectedDesignCode, designCode, documentType]);

    useEffect(() => {
        const form = document.getElementById('templateForm') as HTMLFormElement | null;
        if (!form) {
            return;
        }

        const loadPreview = () => {
            if (
                documentType === 'invoice' &&
                !designOptionsForModule[selectedDesignCode ?? '']
            ) {
                const next = getDefaultDesign(documentType, designOptionsForModule);
                setDesignCode(next);
                return;
            }

            if (previewTimeoutRef.current) {
                window.clearTimeout(previewTimeoutRef.current);
            }

            previewTimeoutRef.current = window.setTimeout(async () => {
                const token = getCsrfToken();

                const xsrfToken = getCookieValue('XSRF-TOKEN');
                const csrfToken = token || xsrfToken;

                const fd = new FormData(form);
                fd.delete('_method');
                if (csrfToken && !fd.has('_token')) {
                    fd.append('_token', csrfToken);
                }
                // Ensure the latest font selection is sent even if state/render lag behind the change event
                fd.set('font_family', fontFamily === DEFAULT_FONT ? '' : fontFamily);

                abortControllerRef.current?.abort();
                const controller = new AbortController();
                abortControllerRef.current = controller;

                try {
                    setPreviewError(null);
                    const previewUrl = '/template/preview';

                    const response = await fetch(previewUrl, {
                        method: 'POST',
                        body: fd,
                        signal: controller.signal,
                        credentials: 'include',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                        },
                        // Use include to support scenarios where the frontend runs on a different
                        // dev host (e.g., Vite) so session cookies are sent with the request.
                        credentials: 'include',
                    });
                    const html = await response.text();
                    if (!response.ok) {
                        setPreviewError(html);
                        return;
                    }

                    setPreviewHtml(html);
                } catch (e: any) {
                    if (e?.name === 'AbortError') {
                        return;
                    }

                    setPreviewError('Failed to load preview');
                }
            }, 350);
        };

        loadPreview();

        form.addEventListener('input', loadPreview);
        form.addEventListener('change', loadPreview);

        return () => {
            form.removeEventListener('input', loadPreview);
            form.removeEventListener('change', loadPreview);
            abortControllerRef.current?.abort();
            if (previewTimeoutRef.current) {
                window.clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [documentType, selectedDesignCode, designOptionsForModule, fontFamily]);

    return (
        <Form id="templateForm" method="post" action={action} className="space-y-6">
            {({ processing, errors }) => (
                <>
                    <input type="hidden" name="_token" value={csrfToken} />
                    {mode === 'edit' && (
                        <input type="hidden" name="_method" value="PUT" />
                    )}

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        required
                                        defaultValue={template?.name ?? ''}
                                    />
                                    <InputError message={(errors as any).name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="document_type">Module</Label>
                                    <input
                                        type="hidden"
                                        name="document_type"
                                        value={documentType}
                                    />
                                    <Select
                                        value={documentType}
                                        onValueChange={(value) => {
                                            setDocumentType(value);
                                            setDesignCode(
                                                getDefaultDesign(
                                                    value,
                                                    resolveDesignOptions(value),
                                                ),
                                            );
                                            triggerFormChange();
                                        }}
                                    >
                                        <SelectTrigger id="document_type" className="h-9">
                                            <SelectValue placeholder="Select module" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="salary_slip">Salary Slip</SelectItem>
                                            <SelectItem value="invoice">Invoice</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={(errors as any).document_type} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="code">Design / Layout</Label>
                                    <input
                                        type="hidden"
                                        name="code"
                                        value={
                                            selectedDesignCode ??
                                            getDefaultDesign(
                                                documentType,
                                                designOptionsForModule,
                                            )
                                        }
                                    />
                                    <Select
                                        key={`${documentType}-design-select`}
                                        value={selectedDesignCode}
                                        onValueChange={(value) => {
                                            setDesignCode(value);
                                            triggerFormChange();
                                        }}
                                    >
                                        <SelectTrigger id="code" className="h-9">
                                            <SelectValue placeholder="Select design" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(
                                                documentType === 'invoice'
                                                    ? invoiceDesignOptions
                                                    : designOptions ?? {},
                                            ).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={(errors as any).code} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="font_family">Font family</Label>
                                    <input
                                        type="hidden"
                                        name="font_family"
                                        value={fontFamily === DEFAULT_FONT ? '' : fontFamily}
                                    />
                                    <Select
                                        value={fontFamily}
                                        onValueChange={(value) => {
                                            setFontFamily(value);
                                            triggerFormChange();
                                        }}
                                    >
                                        <SelectTrigger id="font_family" className="h-9">
                                            <SelectValue placeholder="Select font" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={DEFAULT_FONT}>
                                                Default (Arial)
                                            </SelectItem>
                                            <SelectItem value="Times New Roman, serif">
                                                Times New Roman
                                            </SelectItem>
                                            <SelectItem value="Calibri, sans-serif">Calibri</SelectItem>
                                            <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                                            <SelectItem value="Roboto, sans-serif">Roboto</SelectItem>
                                          
                                        </SelectContent>
                                    </Select>
                                    <InputError message={(errors as any).font_family} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="font_size">Base font size (px)</Label>
                                    <Input
                                        id="font_size"
                                        name="font_size"
                                        type="number"
                                        min={6}
                                        max={24}
                                        defaultValue={
                                            template?.font_size ??
                                            (mode === 'create' ? 12 : '')
                                        }
                                    />
                                    <InputError message={(errors as any).font_size} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="line_height">Line height (px)</Label>
                                    <Input
                                        id="line_height"
                                        name="line_height"
                                        type="number"
                                        min={10}
                                        max={40}
                                        defaultValue={
                                            template?.line_height ??
                                            (mode === 'create' ? 16 : '')
                                        }
                                        required={mode === 'create'}
                                    />
                                    <InputError message={(errors as any).line_height} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="primary_color">Primary color</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="primary_color"
                                            name="primary_color"
                                            type="color"
                                            value={primaryColor}
                                            onChange={(e) => {
                                                setPrimaryColor(e.target.value);
                                                triggerFormChange();
                                            }}
                                            className="w-14 p-1"
                                        />
                                        <Input
                                            type="text"
                                            value={primaryColor}
                                            onChange={(e) => {
                                                setPrimaryColor(normalizeColor(e.target.value, primaryColor));
                                                triggerFormChange();
                                            }}
                                            onBlur={(e) => {
                                                setPrimaryColor(normalizeColor(e.target.value, primaryColor));
                                            }}
                                            className="font-mono text-xs"
                                            title={primaryColor}
                                        />
                                    </div>
                                    <InputError message={(errors as any).primary_color} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="accent_color">Accent color</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="accent_color"
                                            name="accent_color"
                                            type="color"
                                            value={accentColor}
                                            onChange={(e) => {
                                                setAccentColor(e.target.value);
                                                triggerFormChange();
                                            }}
                                            className="w-14 p-1"
                                        />
                                        <Input
                                            type="text"
                                            value={accentColor}
                                            onChange={(e) => {
                                                setAccentColor(normalizeColor(e.target.value, accentColor));
                                                triggerFormChange();
                                            }}
                                            onBlur={(e) => {
                                                setAccentColor(normalizeColor(e.target.value, accentColor));
                                            }}
                                            className="font-mono text-xs"
                                            title={accentColor}
                                        />
                                    </div>
                                    <InputError message={(errors as any).accent_color} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="secondary_color">Body text color</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="secondary_color"
                                            name="secondary_color"
                                            type="color"
                                            value={secondaryColor}
                                            onChange={(e) => {
                                                setSecondaryColor(e.target.value);
                                                triggerFormChange();
                                            }}
                                            className="w-14 p-1"
                                        />
                                        <Input
                                            type="text"
                                            value={secondaryColor}
                                            onChange={(e) => {
                                                setSecondaryColor(normalizeColor(e.target.value, secondaryColor));
                                                triggerFormChange();
                                            }}
                                            onBlur={(e) => {
                                                setSecondaryColor(normalizeColor(e.target.value, secondaryColor));
                                            }}
                                            className="font-mono text-xs"
                                            title={secondaryColor}
                                        />
                                    </div>
                                    <InputError
                                        message={(errors as any).secondary_color}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <textarea
                                    id="description"
                                    name="description"
                                    defaultValue={template?.description ?? ''}
                                    placeholder="Internal note for identifying this template (not shown on documents)"
                                    className="min-h-24 w-full rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                />
                                <InputError message={(errors as any).description} />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="hidden"
                                    name="is_active"
                                    value={
                                        mode === 'create'
                                            ? '1'
                                            : template?.is_active
                                              ? '1'
                                              : '0'
                                    }
                                />
                                <Checkbox
                                    id="is_active"
                                    checked={
                                        mode === 'create'
                                            ? true
                                            : Boolean(template?.is_active)
                                    }
                                    onCheckedChange={(v: boolean | 'indeterminate') => {
                                        const form = document.getElementById(
                                            'templateForm',
                                        ) as HTMLFormElement | null;
                                        const hidden = form?.querySelector(
                                            'input[name="is_active"]',
                                        ) as HTMLInputElement | null;
                                        if (hidden) {
                                            hidden.value = v === true ? '1' : '0';
                                        }
                                        form?.dispatchEvent(
                                            new Event('change', { bubbles: true }),
                                        );
                                    }}
                                />
                                <Label htmlFor="is_active">Active</Label>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button disabled={processing}>Save</Button>
                            </div>
                        </div>

                        <div className="lg:sticky lg:top-4 w-full max-w-[720px]">
                            <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white">
                                {previewError ? (
                                    <pre className="max-h-[720px] overflow-auto p-3 text-xs text-destructive">
                                        {previewError}
                                    </pre>
                                ) : (
                                    <iframe
                                        title="Template preview"
                                        className="h-[720px] w-full"
                                        srcDoc={previewHtml}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </Form>
    );
}
