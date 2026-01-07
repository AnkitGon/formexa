<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Retail Invoice</title>
    @php
        $primary = $template->primary_color ?? '#475569';
        $accent = $template->accent_color ?? '#0f172a';
        $bodyColor = $template->secondary_color ?? '#0f172a';
        $fontFamily = trim((string) ($template->font_family ?? ''));
        if ($fontFamily === '') {
            $fontFamily = 'Arial, sans-serif';
        }
        $fontSize = $template->font_size ?: 12;
        $lineHeight = $template->line_height ?: 18;
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
            --border: #cbd5e1;
            --muted: #64748b;
        }
        * { box-sizing: border-box; }
        body {
            font-family: {{ $fontFamily }} !important;
            margin: 0;
            padding: 16px; /* restore padding; iframe isolates styles */
            color: var(--body);
            background: #ffffff;
            font-size: {{ $fontSize }}px;
            line-height: {{ $lineHeight }}px;
        }
        .receipt {
            max-width: 420px;
            margin: 0 auto;
            border: 1px dashed var(--border);
            padding: 16px;
        }
        h1 { margin: 0 0 6px; font-size: 18px; text-align: center; letter-spacing: 0.4px; color: var(--accent); }
        .muted { color: var(--muted); font-size: max(10px, {{ $fontSize }}px - 1); }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .info { margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 6px 4px; text-align: left; }
        th { font-size: max(10px, {{ $fontSize }}px - 1); text-transform: uppercase; letter-spacing: 0.3px; color: var(--primary); border-bottom: 1px solid #e2e8f0; }
        td { border-bottom: 1px solid #f1f5f9; }
        .total-row td { font-weight: 700; color: var(--accent); }
        .totals { margin-top: 8px; }
        .center { text-align: center; }
        .small { font-size: max(9px, {{ $fontSize }}px - 2); color: var(--primary); }
    </style>
</head>
<body>
    <div class="receipt">
        <h1>Retail Invoice</h1>
        <div class="center muted">POS-friendly, compact layout</div>

        <div class="info row">
            <div style="display:flex; gap:10px; align-items:center;">
                @if (!empty($business_settings['invoice_logo_url']))
                    <div style="width:50px; height:50px; display:flex; align-items:center; justify-content:center;">
                        <img src="{{ $business_settings['invoice_logo_url'] }}" alt="Logo" style="max-width:50px; max-height:50px; object-fit:contain;">
                    </div>
                @endif
                <div><strong>{{ $business_settings['company_name'] ?? 'Your Business' }}</strong></div>
                @if (!empty($business_settings['company_address']))
                    <div class="muted" style="white-space: pre-line;">{{ $business_settings['company_address'] }}</div>
                @endif
                @if (!empty($business_settings['company_email']))
                    <div class="muted">{{ $business_settings['company_email'] }}</div>
                @endif
            </div>
            <div style="text-align:right;">
                <div class="muted">Invoice #: {{ $invoice->invoice_number }}</div>
                <div class="muted">Date: {{ optional($invoice->invoice_date)->format('M d, Y') }}</div>
                @if ($invoice->due_date)
                    <div class="muted">Due: {{ optional($invoice->due_date)->format('M d, Y') }}</div>
                @endif
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:52%;">Item</th>
                    <th style="width:12%;">Qty</th>
                    <th style="width:18%;">Price</th>
                    <th style="width:18%;">Total</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($invoice->items as $item)
                    @php
                        $lineAmount = $item->amount ?? ($item->quantity * $item->unit_price);
                    @endphp
                    <tr>
                        <td>{{ $item->description }}</td>
                        <td>{{ $item->quantity }}</td>
                        <td>{{ $formatMoney($item->unit_price) }}</td>
                        <td>{{ $formatMoney($lineAmount) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" class="center muted" style="padding:12px;">No items added</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="totals">
            <div class="row">
                <div class="muted">Subtotal</div>
                <div>{{ $formatMoney($invoice->subtotal ?? 0) }}</div>
            </div>
            <div class="row">
                <div class="muted">Tax</div>
                <div>{{ $formatMoney($invoice->tax_total ?? 0) }}</div>
            </div>
            @if (($invoice->discount_total ?? 0) > 0)
                <div class="row">
                    <div class="muted">Discount</div>
                    <div>- {{ $formatMoney($invoice->discount_total) }}</div>
                </div>
            @endif
            <div class="row total-row">
                <div>Total</div>
                <div>{{ $formatMoney($invoice->total ?? 0) }}</div>
            </div>
            @if (($invoice->amount_paid ?? 0) > 0)
                <div class="row">
                    <div class="muted">Paid</div>
                    <div>- {{ $formatMoney($invoice->amount_paid) }}</div>
                </div>
            @endif
            <div class="row total-row">
                <div>Balance</div>
                <div>{{ $formatMoney($balanceDue) }}</div>
            </div>
        </div>

        <div class="center small" style="margin-top:10px;">
            Thank you for shopping! No returns without receipt.
        </div>
    </div>
</body>
</html>
