<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice</title>
    @php
        $primary = $template->primary_color ?? '#1f2937';
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
        $currencySymbol = $business_settings['currency_symbol'] ?? '$';
        $formatMoney = function ($value) use ($currencySymbol) {
            return $currencySymbol . number_format((float) $value, 2);
        };

        $status = $invoice->status ?? 'draft';
        $statusLabel = ucfirst(str_replace('_', ' ', $status));
        $client = $invoice->client;
        $businessName = $business_settings['company_name'] ?? 'Your Business';
        $businessEmail = $business_settings['company_email'] ?? null;
        $businessAddress = $business_settings['company_address'] ?? null;
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

        * {
            box-sizing: border-box;
        }

        body {
            font-family: {{ $fontFamily }} !important;
            margin: 0;
            padding: 32px; /* restore natural padding; iframe now isolates styles */
            color: var(--body);
            font-size: {{ $fontSize }}px;
            line-height: {{ $lineHeight }}px;
        }

        .invoice {
            max-width: 900px;
            margin: 0 auto;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 28px;
        }

        .flex-between {
            display: flex;
            justify-content: space-between;
            gap: 16px;
        }

        .text-right {
            text-align: right;
        }

        .muted {
            color: var(--muted);
            font-size: max(10px, {{ $fontSize }}px - 1);
        }

        h1 {
            margin: 0 0 4px;
            font-size: 22px;
            color: var(--accent);
        }

        h3 {
            margin: 12px 0 4px;
            font-size: 14px;
            color: var(--accent);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }

        th {
            background: var(--primary);
            color: #fff;
            padding: 8px;
            font-size: max(10px, {{ $fontSize }}px - 1);
            text-align: left;
        }

        td {
            border-bottom: 1px solid var(--border);
            padding: 8px;
            vertical-align: top;
        }

        .total-row td {
            font-weight: 600;
        }

        .pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: max(10px, {{ $fontSize }}px - 1);
            background: #e5e7eb;
            color: var(--accent);
        }

        .badge-primary {
            background: var(--primary);
            color: #fff;
        }

        .totals {
            width: 280px;
            margin-left: auto;
            margin-top: 16px;
        }

        .totals td {
            border: none;
        }

        .totals .label {
            color: #4b5563;
        }

        .notes {
            margin-top: 18px;
        }
    </style>
</head>

<body>
    <div class="invoice">
        <div class="flex-between" style="align-items:flex-start;">
            <div>
                <h1>Invoice</h1>
                <div>{{ $businessName }}</div>
                @if ($businessAddress)
                    <div class="muted" style="white-space: pre-line;">{{ $businessAddress }}</div>
                @endif
                @if ($businessEmail)
                    <div class="muted">{{ $businessEmail }}</div>
                @endif
            </div>
            <div class="text-right">
                <div class="pill badge-primary">{{ $statusLabel }}</div>
                <div><strong>{{ $invoice->invoice_number }}</strong></div>
                <div class="muted">Date: {{ optional($invoice->invoice_date)->format('M d, Y') }}</div>
                <div class="muted">Due: {{ optional($invoice->due_date)->format('M d, Y') }}</div>
            </div>
        </div>

        <div class="flex-between" style="margin-top:18px;">
            <div style="flex:1;">
                <h3>Bill To</h3>
                @if ($client)
                    <div><strong>{{ $client->company_name ?? $client->name }}</strong></div>
                    @if ($client->company_name)
                        <div class="muted">{{ $client->name }}</div>
                    @endif
                    @if ($client->address)
                        <div class="muted" style="white-space: pre-line;">{{ $client->address }}</div>
                    @endif
                    @if ($client->email)
                        <div class="muted">{{ $client->email }}</div>
                    @endif
                @else
                    <div class="muted">No client selected</div>
                @endif
            </div>
            <div style="flex:1;" class="text-right">
                <h3>Summary</h3>
                <div class="muted">Currency: {{ $invoice->currency ?? 'USD' }}</div>
                @if ($invoice->terms)
                    <div class="muted">Terms: {{ $invoice->terms }}</div>
                @endif
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:40%;">Description</th>
                    <th style="width:12%;">Qty</th>
                    <th style="width:12%;">Price</th>
                    <th style="width:12%;">Tax</th>
                    <th style="width:12%;">Discount</th>
                    <th style="width:12%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($invoice->items as $item)
                    @php
                        $lineAmount = $item->amount ?? ($item->quantity * $item->unit_price);
                        $taxDisplay = '—';
                        if (($item->tax_rate ?? 0) > 0) {
                            $taxDisplay = ($item->tax_type ?? 'percent') === 'fixed'
                                ? $formatMoney($item->tax_rate)
                                : number_format($item->tax_rate, 2) . '%';
                        }
                    @endphp
                    <tr>
                        <td>
                            <strong>{{ $item->description }}</strong>
                        </td>
                        <td>{{ $item->quantity }}</td>
                        <td>{{ $formatMoney($item->unit_price) }}</td>
                        <td>{{ $taxDisplay }}</td>
                        <td>—</td>
                        <td>{{ $formatMoney($lineAmount) }}</td>
                    </tr>
                @empty
                    <tr class="muted">
                        <td colspan="6" style="text-align:center;">No items added</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <table class="totals">
            <tr>
                <td class="label">Subtotal</td>
                <td class="text-right">{{ $formatMoney($invoice->subtotal ?? 0) }}</td>
            </tr>
            <tr>
                <td class="label">Tax</td>
                <td class="text-right">{{ $formatMoney($invoice->tax_total ?? 0) }}</td>
            </tr>
            @if (($invoice->discount_total ?? 0) > 0)
                <tr>
                    <td class="label">Discounts</td>
                    <td class="text-right">- {{ $formatMoney($invoice->discount_total) }}</td>
                </tr>
            @endif
            <tr class="total-row">
                <td>Total</td>
                <td class="text-right">{{ $formatMoney($invoice->total ?? 0) }}</td>
            </tr>
            @if (($invoice->amount_paid ?? 0) > 0)
                <tr>
                    <td class="label">Paid</td>
                    <td class="text-right">- {{ $formatMoney($invoice->amount_paid) }}</td>
                </tr>
            @endif
            <tr class="total-row">
                <td>Balance Due</td>
                <td class="text-right">{{ $formatMoney($balanceDue) }}</td>
            </tr>
        </table>

        <div class="notes">
            <h3>Notes</h3>
            @if ($invoice->notes)
                <div class="muted" style="white-space: pre-line;">{{ $invoice->notes }}</div>
            @else
                <div class="muted">Thank you for your business.</div>
            @endif
        </div>
    </div>
</body>

</html>
