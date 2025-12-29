<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Freelance Invoice</title>
    @php
        $primary = $template->primary_color ?? '#0f172a';
        $accent = $template->accent_color ?? '#075985';
        $bodyColor = $template->secondary_color ?? '#0f172a';
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
        $balanceDue = max(0, ($invoice->total ?? 0) - ($invoice->amount_paid ?? 0));
    @endphp

    <style>
        :root {
            --primary: {{ $primary }};
            --accent: {{ $accent }};
            --body: {{ $bodyColor }};
            --muted: #64748b;
            --border: #e2e8f0;
        }
        * { box-sizing: border-box; }
        body {
            font-family: {{ $fontFamily }} !important;
            margin: 0;
            padding: 32px;
            color: var(--body);
            background: #f8fafc;
            font-size: {{ $fontSize }}px;
            line-height: {{ $lineHeight }}px;
        }
        .wrap {
            max-width: 860px;
            margin: 0 auto;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }
        .top {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: flex-start;
        }
        h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 0.5px; color: var(--primary); }
        .pill {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: max(10px, {{ $fontSize }}px - 1);
            background: #e0f2fe;
            color: var(--accent);
        }
        .muted { color: var(--muted); font-size: max(10px, {{ $fontSize }}px - 1); }
        .section {
            margin-top: 20px;
            padding: 14px 16px;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #f8fafc;
        }
        .section h3 {
            margin: 0 0 8px;
            font-size: 13px;
            letter-spacing: 0.3px;
            color: var(--primary);
        }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { padding: 12px 10px; text-align: left; }
        th {
            font-size: max(10px, {{ $fontSize }}px - 1);
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #475569;
            background: #f1f5f9;
            border-bottom: 1px solid var(--border);
        }
        td { border-bottom: 1px solid #eef2f6; }
        .desc {
            font-weight: 600;
            color: var(--primary);
        }
        .small { font-size: max(10px, {{ $fontSize }}px - 1); color: var(--muted); }
        .totals {
            width: 260px;
            margin-left: auto;
            margin-top: 16px;
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
        }
        .totals td { border: none; padding: 10px 12px; }
        .totals .label { color: #475569; }
        .totals .total { font-weight: 700; font-size: 13px; color: var(--primary); }
        .footer-note {
            margin-top: 18px;
            font-size: max(10px, {{ $fontSize }}px - 1);
            color: #475569;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="top">
            <div>
                <h1>Invoice</h1>
                <div class="muted">Freelance / Service Invoice</div>
            </div>
            <div class="text-right">
                @if ($invoice->status)
                    <div class="pill">{{ ucfirst(str_replace('_', ' ', $invoice->status)) }}</div>
                @endif
                <div class="muted" style="margin-top:6px;">Invoice #</div>
                <div><strong>{{ $invoice->invoice_number }}</strong></div>
                <div class="muted">Issued: {{ optional($invoice->invoice_date)->format('M d, Y') }}</div>
                @if ($invoice->due_date)
                    <div class="muted">Due: {{ optional($invoice->due_date)->format('M d, Y') }}</div>
                @endif
            </div>
        </div>

        <div class="section" style="display:flex; gap:18px;">
            <div style="flex:1;">
                <h3>From</h3>
                <div class="desc">{{ $business_settings['company_name'] ?? 'Your Business' }}</div>
                @if (!empty($business_settings['company_email']))
                    <div class="muted">{{ $business_settings['company_email'] }}</div>
                @endif
                @if (!empty($business_settings['company_address']))
                    <div class="muted" style="white-space: pre-line;">{{ $business_settings['company_address'] }}</div>
                @endif
            </div>
            <div style="flex:1;">
                <h3>Bill To</h3>
                @if ($invoice->client)
                    <div class="desc">{{ $invoice->client->company_name ?? $invoice->client->name }}</div>
                    @if ($invoice->client->email)
                        <div class="muted">{{ $invoice->client->email }}</div>
                    @endif
                    @if ($invoice->client->address)
                        <div class="muted" style="white-space: pre-line;">{{ $invoice->client->address }}</div>
                    @endif
                @else
                    <div class="muted">No client selected</div>
                @endif
            </div>
        </div>

        @if ($invoice->notes)
            <div class="section">
                <h3>Project</h3>
                <div class="desc">{{ $invoice->notes }}</div>
            </div>
        @endif

        <table>
            <thead>
                <tr>
                    <th style="width:60%;">Description</th>
                    <th style="width:16%;">Rate</th>
                    <th style="width:24%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($invoice->items as $item)
                    @php
                        $lineAmount = $item->amount ?? ($item->quantity * $item->unit_price);
                    @endphp
                    <tr>
                        <td>
                            <div class="desc">{{ $item->description }}</div>
                        </td>
                        <td>{{ $formatMoney($item->unit_price) }}</td>
                        <td>{{ $formatMoney($lineAmount) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3" class="small" style="text-align:center; padding:12px 8px;">
                            No items added
                        </td>
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
                    <td class="label">Discount</td>
                    <td class="text-right">- {{ $formatMoney($invoice->discount_total) }}</td>
                </tr>
            @endif
            <tr class="total-row">
                <td class="total">Total</td>
                <td class="text-right total">{{ $formatMoney($invoice->total ?? 0) }}</td>
            </tr>
            <tr>
                <td class="label">Due</td>
                <td class="text-right">{{ $formatMoney($balanceDue) }}</td>
            </tr>
        </table>

        <div class="notes">
            <h3 style="margin:16px 0 6px; font-size:13px;">Payment</h3>
            <div class="small">PayPal: pay@indigo.studio &nbsp;|&nbsp; Wire: INDIGO STUDIO / ABA 123456789</div>
        </div>

        <div class="footer-note">
            Need a minor copy tweak? Included. Major changes billed separately.
        </div>
    </div>
</body>
</html>
