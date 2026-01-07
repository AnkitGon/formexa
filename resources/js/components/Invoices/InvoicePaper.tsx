
import { cn } from '@/lib/utils';
import { Mail, MapPin, Phone } from 'lucide-react';

// Define loose interfaces to accept both saved invoice and form data
export interface InvoiceData {
    invoice_number: string;
    invoice_date: string;
    due_date?: string | null;
    status: string;
    notes?: string | null;
    terms?: string | null;
    discount_mode?: 'none' | 'item' | 'invoice';
    discount_total?: number;
    discount_value?: number; // invoice level value
    discount_type?: 'fixed' | 'percent';
    subtotal: number;
    tax_total: number;
    total: number;
    client?: {
        name: string;
        company_name?: string | null;
        address?: string | null;
        email?: string | null;
        phone?: string | null;
        tax_id?: string | null;
    } | null;
    items: Array<{
        description: string;
        quantity: number | string;
        unit_price: number | string;
        amount?: number;
        tax_rate?: number | string;
        tax_type?: 'percent' | 'fixed' | string | null;
        tax_id?: number | string | null;
        discount_value?: number | string;
        discount_type?: 'fixed' | 'percent';
        discount_amount?: number; // calculated amount
    }>;
    // Branding snapshots
    currency_symbol?: string;
    currency_position?: 'before' | 'after';
    decimal_precision?: number;
    thousands_separator?: string;
    decimal_separator?: string;
    template_style?: string;
    primary_color?: string;
    show_logo?: boolean | number | string;
}

export interface BusinessData {
    name: string;
    email?: string;
    address?: string;
    logo_url?: string | null;
}

interface InvoicePaperProps {
    data: InvoiceData;
    business: BusinessData;
    className?: string;
}

export default function InvoicePaper({ data, business, className }: InvoicePaperProps) {
    // Helper for currency formatting
    const formatCurrency = (amount: number | string | undefined) => {
        const num = Number(amount) || 0;
        const precision = Number(data.decimal_precision ?? 2);
        const thousands = data.thousands_separator ?? ',';
        const decimal = data.decimal_separator ?? '.';
        const symbol = data.currency_symbol ?? '$';
        const position = data.currency_position ?? 'before';

        const parts = num.toFixed(precision).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
        const formattedNum = parts.join(decimal);

        return position === 'before' ? `${symbol}${formattedNum}` : `${formattedNum}${symbol}`;
    };

    // Style variants
    const isModern = data.template_style === 'modern';
    const isMinimal = data.template_style === 'minimal';
    const primaryColor = data.primary_color ?? '#000000';

    return (
        <div
            className={cn("bg-white text-black shadow-sm border mx-auto", className)}
            style={{
                width: '210mm',
                minHeight: '297mm', // A4 height
                padding: '10mm', // Safe printable margin
                fontSize: '10pt', // Standard print size
                boxSizing: 'border-box'
            }}
        >
            {/* Header Area */}
            <div className={cn("flex justify-between items-start mb-12", isModern && "flex-row-reverse")}>
                <div className={cn("w-1/2", isModern && "text-right")}>
                    {(data.show_logo) && business.logo_url ? (
                        <img src={business.logo_url} alt="Logo" className={cn("h-16 object-contain mb-4", isModern && "ml-auto")} />
                    ) : (data.show_logo) ? (
                        <div className={cn("h-12 w-12 bg-gray-200 rounded mb-4 flex items-center justify-center text-xs font-bold text-gray-500", isModern && "ml-auto")}>
                            LOGO
                        </div>
                    ) : null}

                    <h2 className="font-bold text-lg" style={{ color: isModern ? primaryColor : 'inherit' }}>{business.name}</h2>
                    {business.email && <p className="text-gray-500 text-sm">{business.email}</p>}
                    {business.address && <p className="text-gray-500 text-sm whitespace-pre-line">{business.address}</p>}
                </div>

                <div className={cn("w-1/2 text-right", isModern && "text-left")}>
                    <h1 className="text-4xl font-light uppercase tracking-widest text-gray-300 mb-4">Invoice</h1>

                    <div className="space-y-1">
                        <div className="flex justify-end gap-4" style={{ flexDirection: isModern ? 'row-reverse' : 'row' }}>
                            <span className="text-gray-500 font-medium">Invoice #</span>
                            <span className="font-bold">{data.invoice_number}</span>
                        </div>
                        <div className="flex justify-end gap-4" style={{ flexDirection: isModern ? 'row-reverse' : 'row' }}>
                            <span className="text-gray-500">Date</span>
                            <span>{data.invoice_date}</span>
                        </div>
                        {data.due_date && (
                            <div className="flex justify-end gap-4" style={{ flexDirection: isModern ? 'row-reverse' : 'row' }}>
                                <span className="text-gray-500">Due Date</span>
                                <span>{data.due_date}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bill To */}
            <div className="mb-12 border-l-4 pl-4" style={{ borderColor: primaryColor }}>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bill To</p>
                {data.client ? (
                    <div>
                        <h3 className="font-bold text-lg">{data.client.company_name || data.client.name}</h3>
                        {data.client.company_name && <p className="text-gray-600">{data.client.name}</p>}
                        <p className="text-gray-600 whitespace-pre-line">{data.client.address}</p>
                        {data.client.email && (
                            <div className="flex items-center gap-2 mt-1 text-gray-600">
                                <Mail className="w-3 h-3" /> {data.client.email}
                            </div>
                        )}
                        {data.client.tax_id && <p className="text-gray-500 text-sm mt-1">Tax ID: {data.client.tax_id}</p>}
                    </div>
                ) : (
                    <p className="text-gray-400 italic">No client selected</p>
                )}
            </div>

            {/* Items */}
            <table className="w-full mb-8">
                <thead>
                    <tr style={{ backgroundColor: isMinimal ? 'transparent' : '#f9fafb' }}>
                        <th className="py-3 px-4 text-left font-bold text-gray-600 border-b">Description</th>
                        <th className="py-3 px-4 text-right font-bold text-gray-600 border-b w-16">Qty</th>
                        <th className="py-3 px-4 text-right font-bold text-gray-600 border-b w-24">Price</th>
                        {data.discount_mode === 'item' && (
                            <th className="py-3 px-4 text-right font-bold text-gray-600 border-b w-24">Discount</th>
                        )}
                        <th className="py-3 px-4 text-right font-bold text-gray-600 border-b w-24">Tax</th>
                        <th className="py-3 px-4 text-right font-bold text-gray-600 border-b w-28">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, index) => {
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.unit_price) || 0;
                        const baseAmount = qty * price;

                        let itemDiscount = 0;
                        // If explicit amount is provided (from backend) use it, otherwise calc
                        if (item.discount_amount !== undefined) {
                            itemDiscount = Number(item.discount_amount);
                        } else if (data.discount_mode === 'item') {
                            const dVal = Number(item.discount_value) || 0;
                            if (item.discount_type === 'percent') {
                                itemDiscount = baseAmount * (dVal / 100);
                            } else {
                                itemDiscount = dVal;
                            }
                            if (itemDiscount > baseAmount) itemDiscount = baseAmount;
                        }

                        const taxable = baseAmount - itemDiscount;

                        return (
                            <tr key={index} className="border-b border-gray-100 last:border-0">
                                <td className="py-3 px-4 text-gray-800">{item.description || <span className="text-gray-300 italic">Item description</span>}</td>
                                <td className="py-3 px-4 text-right text-gray-600">{qty}</td>
                                <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(price)}</td>
                                {data.discount_mode === 'item' && (
                                    <td className="py-3 px-4 text-right text-rose-600">
                                        {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '—'}
                                    </td>
                                )}
                                <td className="py-3 px-4 text-right text-gray-600">
                                    {item.tax_rate
                                        ? `${item.tax_type === 'fixed' ? formatCurrency(item.tax_rate) : `${item.tax_rate}%`}`
                                        : '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-gray-900">
                                    {formatCurrency(taxable)} {/* Usually amount column is taxable amount or total? Let's assume taxable amount (subtotal - discount) */}
                                </td>
                            </tr>
                        );
                    })}
                    {data.items.length === 0 && (
                        <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-400 italic">No items added</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-1/2 max-w-xs space-y-3">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatCurrency(data.subtotal)}</span>
                    </div>
                    {data.discount_total !== undefined && data.discount_total > 0 && (
                        <div className="flex justify-between text-rose-600">
                            <span>Discount</span>
                            <span>-{formatCurrency(data.discount_total)}</span>
                        </div>
                    )}
                    {(data.tax_total > 0) && (
                        <div className="flex justify-between text-gray-600">
                            <span>Tax</span>
                            <span>{formatCurrency(data.tax_total)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xl font-bold pt-4 border-t border-gray-200" style={{ color: primaryColor }}>
                        <span>Total</span>
                        <span>{formatCurrency(data.total)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 gap-8 text-sm mt-auto pt-8 border-t border-gray-100">
                {data.notes && (
                    <div>
                        <h4 className="font-bold mb-2 text-gray-800">Notes</h4>
                        <p className="text-gray-600 whitespace-pre-line">{data.notes}</p>
                    </div>
                )}
                {data.terms && (
                    <div>
                        <h4 className="font-bold mb-2 text-gray-800">Terms & Conditions</h4>
                        <p className="text-gray-600 whitespace-pre-line">{data.terms}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
