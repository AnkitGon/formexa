<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tax Invoice</title>
    @php
        $primary = $template->primary_color ?? '#111827';
        $accent = $template->accent_color ?? '#111827';
        $bodyColor = $template->secondary_color ?? '#111827';
        $fontFamily = trim((string) ($template->font_family ?? ''));
        if ($fontFamily === '') {
            $fontFamily = 'Arial, sans-serif';
        }
        $fontSize = $template->font_size ?: 12;
        $lineHeight = $template->line_height ?: 19;
    @endphp
    @php
        $currencySymbol = $business_settings['currency_symbol'] ?? '€';
        $formatMoney = function ($value) use ($currencySymbol) {
            return $currencySymbol . number_format((float) $value, 2);
        };
        $balanceDue = max(0, ($invoice->total ?? 0) - ($invoice->amount_paid ?? 0));
    @endphp

    <style>
        :root {
            --primary: {{ $primary }};
            --accent: {{ $accent }};
            --body: {{ $bodyColor }};
            --border: #e5e7eb;
            --muted: #6b7280;
        }
        * { box-sizing: border-box; }
        body {
            font-family: {{ $fontFamily }} !important;
            margin: 0;
            padding: 32px; /* restore padding; iframe isolates styles */
            color: var(--body);
            font-size: {{ $fontSize }}px;
            line-height: {{ $lineHeight }}px;
            background: #f9fafb;
        }
        .invoice {
            max-width: 920px;
            margin: 0 auto;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 24px;
        }
        .flex-between { display: flex; justify-content: space-between; gap: 16px; }
        .muted { color: var(--muted); font-size: max(10px, {{ $fontSize }}px - 1); }
        h1 { margin: 0 0 6px; font-size: 22px; color: var(--accent); letter-spacing: 0.3px; }
        h3 { margin: 12px 0 6px; font-size: 14px; color: var(--accent); }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: var(--primary); color: #fff; padding: 8px; font-size: max(10px, {{ $fontSize }}px - 1); text-align: left; }
        td { border-bottom: 1px solid var(--border); padding: 8px; vertical-align: top; }
        .totals { width: 320px; margin-left: auto; margin-top: 16px; }
        .totals td { border: none; padding: 6px 4px; }
        .totals .label { color: #4b5563; }
        .pill {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: max(10px, {{ $fontSize }}px - 1);
            background: var(--primary);
            color: #fff;
        }
        .panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
            margin-top: 14px;
        }
        .tax-table td, .tax-table th { border: 1px solid var(--border); }
        .tax-table th {
            background: #f1f5f9;
            color: var(--accent);
            text-align: center;
        }
            background: #eef2f7;
            border-bottom: 1px solid #e2e8f0;
        }
        td { border-bottom: 1px solid #eef2f6; vertical-align: top; }
        .desc { font-weight: 600; color: #0f172a; }
        .small { font-size: 11px; color: #64748b; }
        .tax-table {
            margin-top: 10px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
        }
        .tax-table th { background: #0f172a; color: #fff; }
        .totals {
            width: 280px;
            margin-left: auto;
            margin-top: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
        }
        .totals td { border: none; padding: 10px 12px; }
        .totals .label { color: #475569; }
        .totals .total { font-weight: 700; font-size: 13px; }
        .note { margin-top: 16px; font-size: 11px; color: #475569; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="header">
            <div>
                <h1>Tax Invoice</h1>
                <div class="muted">Compliant layout for VAT / GST</div>
            </div>
            <div style="text-align:right;">
                @if ($invoice->status)
                    <div class="pill">{{ ucfirst(str_replace('_', ' ', $invoice->status)) }}</div>
                @endif
                <div class="muted" style="margin-top:6px;">Invoice #: {{ $invoice->invoice_number }}</div>
                <div class="muted">Date: {{ optional($invoice->invoice_date)->format('M d, Y') }}</div>
                @if ($invoice->due_date)
                    <div class="muted">Due: {{ optional($invoice->due_date)->format('M d, Y') }}</div>
                @endif
            </div>
        </div>

        <div class="section" style="display:flex; gap:18px;">
            <div style="flex:1;">
                <h3>Supplier</h3>
                <div class="desc">{{ $business_settings['company_name'] ?? 'Your Business' }}</div>
                @if (!empty($business_settings['company_address']))
                    <div class="muted" style="white-space: pre-line;">{{ $business_settings['company_address'] }}</div>
                @endif
                @if (!empty($business_settings['company_email']))
                    <div class="muted">{{ $business_settings['company_email'] }}</div>
                @endif
            </div>
            <div style="flex:1;">
                <h3>Customer</h3>
                @if ($invoice->client)
                    <div class="desc">{{ $invoice->client->company_name ?? $invoice->client->name }}</div>
                    @if ($invoice->client->address)
                        <div class="muted" style="white-space: pre-line;">{{ $invoice->client->address }}</div>
                    @endif
                    @if ($invoice->client->email)
                        <div class="muted">{{ $invoice->client->email }}</div>
                    @endif
                @else
                    <div class="muted">No client selected</div>
                @endif
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:45%;">Description</th>
                    <th style="width:12%;">Qty</th>
                    <th style="width:12%;">Unit</th>
                    <th style="width:13%;">Net</th>
                    <th style="width:18%;">Tax Code</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($invoice->items as $item)
                    @php
                        $lineAmount = $item->amount ?? ($item->quantity * $item->unit_price);
                        $taxLabel = '—';
                        if (($item->tax_rate ?? 0) > 0) {
                            $taxLabel = ($item->tax_type ?? 'percent') === 'fixed'
                                ? $formatMoney($item->tax_rate)
                                : number_format($item->tax_rate, 2) . '%';
                        }
                    @endphp
                    <tr>
                        <td>
                            <div class="desc">{{ $item->description }}</div>
                        </td>
                        <td>{{ $item->quantity }}</td>
                        <td>{{ $item->unit ?? 'unit' }}</td>
                        <td>{{ $formatMoney($lineAmount) }}</td>
                        <td>{{ $taxLabel }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="small" style="text-align:center; padding:10px 8px;">
                            No items added
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="tax-table">
            <table>
                <thead>
                    <tr>
                        <th style="width:20%;">Tax Code</th>
                        <th style="width:20%;">Rate</th>
                        <th style="width:30%;">Taxable Base</th>
                        <th style="width:30%;">Tax Amount</th>
                    </tr>
                </thead>
                <tbody>
                    @php
                        $taxGroups = [];
                        foreach ($invoice->items as $item) {
                            $amount = $item->amount ?? ($item->quantity * $item->unit_price);
                            $rate = (float) ($item->tax_rate ?? 0);
                            $type = $item->tax_type ?? 'percent';
                            if ($rate <= 0) {
                                continue;
                            }
                            $key = $type . ':' . $rate;
                            if (! isset($taxGroups[$key])) {
                                $taxGroups[$key] = ['base' => 0, 'tax' => 0, 'label' => $type === 'fixed' ? $formatMoney($rate) : $rate . '%'];
                            }
                            $taxBase = $type === 'fixed' ? 0 : $amount;
                            $taxAmount = $type === 'fixed' ? $rate * $item->quantity : $amount * ($rate / 100);
                            $taxGroups[$key]['base'] += $taxBase;
                            $taxGroups[$key]['tax'] += $taxAmount;
                        }
                    @endphp
                    @forelse ($taxGroups as $group)
                        <tr>
                            <td>Tax</td>
                            <td>{{ $group['label'] }}</td>
                            <td>{{ $formatMoney($group['base']) }}</td>
                            <td>{{ $formatMoney($group['tax']) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="small" style="text-align:center; padding:10px 8px;">
                                No taxes applied
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <table class="totals">
            <tr>
                <td class="label">Net Total</td>
                <td class="text-right">{{ $formatMoney($invoice->subtotal ?? 0) }}</td>
            </tr>
            <tr>
                <td class="label">VAT Total</td>
                <td class="text-right">{{ $formatMoney($invoice->tax_total ?? 0) }}</td>
            </tr>
            @if (($invoice->discount_total ?? 0) > 0)
                <tr>
                    <td class="label">Discounts</td>
                    <td class="text-right">- {{ $formatMoney($invoice->discount_total) }}</td>
                </tr>
            @endif
            <tr class="total-row">
                <td class="total">Invoice Total</td>
                <td class="text-right total">{{ $formatMoney($invoice->total ?? 0) }}</td>
            </tr>
            @if (($invoice->amount_paid ?? 0) > 0)
                <tr>
                    <td class="label">Paid</td>
                    <td class="text-right">- {{ $formatMoney($invoice->amount_paid) }}</td>
                </tr>
            @endif
            <tr class="total-row">
                <td class="total">Balance Due</td>
                <td class="text-right total">{{ $formatMoney($balanceDue) }}</td>
            </tr>
        </table>

        <div class="note">
            @if ($invoice->notes)
                {{ $invoice->notes }}
            @else
                Reverse charge not applicable. Please include VAT IDs on remittance.
            @endif
        </div>
    </div>
</body>
</html>
