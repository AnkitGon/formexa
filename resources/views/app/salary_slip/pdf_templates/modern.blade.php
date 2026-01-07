@php
    $primaryColor = $template->primary_color ?? '#1f2937';
    $accentColor = $template->accent_color ?? '#111827';
    $textColor = $template->secondary_color ?? '#333333';
    $fontFamily = trim((string) ($template->font_family ?? ''));
    if ($fontFamily === '') {
        $fontFamily = 'Arial, sans-serif';
    }
    $fontSize = $template->font_size ?? 11;
    $lineHeight = $template->line_height ?? (int) round($fontSize * 1.4);

    $meta = $salarySlip->meta ?? [];
    if (!is_array($meta)) {
        $meta = [];
    }

    $heading = trim((string) ($meta['heading'] ?? 'Payslip'));
    $companyName = trim((string) ($meta['company_name'] ?? ''));
    $companyAddress = $meta['company_address'] ?? '';
    if (is_string($companyAddress)) {
        $companyAddressLines = preg_split('/\r\n|\r|\n/', $companyAddress);
    } elseif (is_array($companyAddress)) {
        $companyAddressLines = $companyAddress;
    } else {
        $companyAddressLines = [];
    }
    $payPeriod = trim((string) ($meta['pay_period'] ?? ($salarySlip->pay_period ?? '')));

    $payslipLabels = $meta['payslip_labels'] ?? [];
    $employeeLabels = $meta['employee_labels'] ?? [];
    $payslipExtra = $meta['payslip_extra'] ?? [];
    $employeeExtra = $meta['employee_extra'] ?? [];

    if (!is_array($payslipLabels)) {
        $payslipLabels = [];
    }
    if (!is_array($employeeLabels)) {
        $employeeLabels = [];
    }
    if (!is_array($payslipExtra)) {
        $payslipExtra = [];
    }
    if (!is_array($employeeExtra)) {
        $employeeExtra = [];
    }

    $settingsDefaults = $settingsDefaults ?? [];
    $defaultCurrency = $settingsDefaults['default_currency'] ?? 'USD';
    $currencySymbolPosition = $settingsDefaults['currency_symbol_position'] ?? 'prefix';

    $dateFormatSetting = $settingsDefaults['date_format'] ?? 'YYYY-MM-DD';
    $timeFormatSetting = $settingsDefaults['time_format'] ?? 'hh:mm A';

    $phpDateFormat = match ($dateFormatSetting) {
        'DD/MM/YYYY' => 'd/m/Y',
        'MM/DD/YYYY' => 'm/d/Y',
        default => 'Y-m-d',
    };

    $phpTimeFormat = match ($timeFormatSetting) {
        'HH:mm' => 'H:i',
        'HH:mm:ss' => 'H:i:s',
        default => 'h:i A',
    };

    $formatValue = function ($value, bool $includeTime = false) use ($phpDateFormat, $phpTimeFormat) {
        if ($value === null || $value === '') {
            return '';
        }

        try {
            $dt = \Carbon\Carbon::parse($value);
            return $includeTime
                ? $dt->format($phpDateFormat . ' ' . $phpTimeFormat)
                : $dt->format($phpDateFormat);
        } catch (\Throwable $e) {
            return $value;
        }
    };

    $shouldFormatAsDate = function ($value): bool {
        if (! is_string($value)) {
            return false;
        }

        $value = trim($value);
        if ($value === '') {
            return false;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/', $value)) {
            return true;
        }

        if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $value)) {
            return true;
        }

        if (preg_match('/^\d{4}\/\d{1,2}\/\d{1,2}$/', $value)) {
            return true;
        }

        return false;
    };

    $shouldIncludeTime = function ($value): bool {
        if (! is_string($value)) {
            return false;
        }

        return (bool) preg_match('/\d{1,2}:\d{2}/', $value);
    };

    $earnings = $meta['earnings'] ?? [];
    $deductions = $meta['deductions'] ?? [];

    if (! is_array($earnings)) {
        $earnings = [];
    }
    if (! is_array($deductions)) {
        $deductions = [];
    }

    $formatCurrency = function ($value) use ($defaultCurrency, $currencySymbolPosition) {
        $amount = (float) ($value ?? 0);
        $base = number_format($amount, 2);
        // Render currency code to avoid unsupported glyphs
        if ($currencySymbolPosition === 'suffix') {
            return $base . ' ' . $defaultCurrency;
        }

        return $defaultCurrency . ' ' . $base;
    };

    $payslipRows = [];
    foreach ($payslipLabels as $key => $label) {
        $label = trim((string) $label);
        if ($label === '') {
            continue;
        }

        $value = $meta[$key] ?? ($salarySlip->{$key} ?? null);
        if ($value === null || $value === '') {
            continue;
        }

        $payslipRows[] = [
            'label' => $label,
            'value' => $value,
            'display' => $shouldFormatAsDate($value) ? $formatValue($value, $shouldIncludeTime($value)) : $value,
        ];
    }

    foreach ($payslipExtra as $item) {
        $label = trim((string) ($item['label'] ?? ''));
        if ($label === '') {
            continue;
        }

        $value = $item['value'] ?? '';

        $payslipRows[] = [
            'label' => $label,
            'value' => $value,
            'display' => $shouldFormatAsDate($value) ? $formatValue($value, $shouldIncludeTime($value)) : $value,
        ];
    }

    $employeeRows = [];
    foreach ($employeeLabels as $key => $label) {
        $label = trim((string) $label);
        if ($label === '') {
            continue;
        }

        $value = $meta[$key] ?? ($salarySlip->{$key} ?? null);
        if ($value === null || $value === '') {
            continue;
        }

        $employeeRows[] = [
            'label' => $label,
            'value' => $value,
            'display' => $shouldFormatAsDate($value) ? $formatValue($value, $shouldIncludeTime($value)) : $value,
        ];
    }

    foreach ($employeeExtra as $item) {
        $label = trim((string) ($item['label'] ?? ''));
        if ($label === '') {
            continue;
        }

        $value = $item['value'] ?? '';

        $employeeRows[] = [
            'label' => $label,
            'value' => $value,
            'display' => $shouldFormatAsDate($value) ? $formatValue($value, $shouldIncludeTime($value)) : $value,
        ];
    }

    $infoRows = max(count($payslipRows), count($employeeRows));

    $maxRows = max(count($earnings), count($deductions));

    $basic = (float) ($salarySlip->basic_salary ?? 0);
    $allowance = (float) ($salarySlip->allowance_amount ?? 0);
    $deductionAmount = (float) ($salarySlip->deduction_amount ?? 0);
    $totalEarnings = $basic + $allowance;
    $totalDeductions = $deductionAmount;
    $netSalary = (float) ($salarySlip->net_salary ?? $totalEarnings - $totalDeductions);

    $netPayInWords = $meta['net_pay_in_words'] ?? null;
    $showNetPayInWords = $meta['show_net_pay_in_words'] ?? true;
    $showNetPayInWords = ! ($showNetPayInWords === false || $showNetPayInWords === 0 || $showNetPayInWords === '0');

    $legacyShowSignaturesInPdf = $meta['show_signatures_in_pdf'] ?? true;
    $legacyShowSignaturesInPdf = ! ($legacyShowSignaturesInPdf === false || $legacyShowSignaturesInPdf === 0 || $legacyShowSignaturesInPdf === '0');

    $showEmployerSignatureInPdf = $meta['show_employer_signature_in_pdf'] ?? null;
    if ($showEmployerSignatureInPdf === null || $showEmployerSignatureInPdf === '') {
        $showEmployerSignatureInPdf = $legacyShowSignaturesInPdf;
    }
    $showEmployerSignatureInPdf = ! ($showEmployerSignatureInPdf === false || $showEmployerSignatureInPdf === 0 || $showEmployerSignatureInPdf === '0');

    $showEmployeeSignatureInPdf = $meta['show_employee_signature_in_pdf'] ?? null;
    if ($showEmployeeSignatureInPdf === null || $showEmployeeSignatureInPdf === '') {
        $showEmployeeSignatureInPdf = $legacyShowSignaturesInPdf;
    }
    $showEmployeeSignatureInPdf = ! ($showEmployeeSignatureInPdf === false || $showEmployeeSignatureInPdf === 0 || $showEmployeeSignatureInPdf === '0');

    $employerSignature = $meta['employer_signature'] ?? null;
    $employeeSignature = $meta['employee_signature'] ?? null;

    $hasEmployerSignature = $showEmployerSignatureInPdf && is_string($employerSignature) && trim($employerSignature) !== '';
    $hasEmployeeSignature = $showEmployeeSignatureInPdf && is_string($employeeSignature) && trim($employeeSignature) !== '';
@endphp
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Salary Slip #{{ $salarySlip->id }} - Modern</title>
    <style>
        @page {
            margin: 18px 18px;
        }

        body {
            font-family: {{ $fontFamily }};
            font-size: {{ $fontSize }}px;
            color: {{ $textColor }};
            line-height: {{ $lineHeight }}px;
        }

        .wrapper {
            width: 92%;
            max-width: 760px;
            margin-left: auto;
            margin-right: auto;
            padding: 18px 18px;
            padding-bottom: 170px;
            box-sizing: border-box;
        }

        .header {
            margin-bottom: 18px;
            padding: 10px 12px;
            background: {{ $primaryColor }};
            color: #f9fafb;
        }

        .header-title {
            font-size: 1.45em;
            font-weight: bold;
        }

        .header-sub {
            font-size: 1em;
        }

        .grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }

        .grid td,
        .grid th {
            padding: 4px 6px;
            border: 1px solid {{ $accentColor }};
        }

        .grid th {
            background: {{ $primaryColor }};
            color: #ffffff;
            text-align: left;
        }

        .text-right {
            text-align: right;
        }

        .summary-row th {
            background: {{ $primaryColor }};
            color: #f9fafb;
        }

        .muted {
            color: #6b7280;
            font-size: 0.9em;
        }

        .signature-grid {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
        }

        .signature-cell {
            width: 50%;
            vertical-align: top;
        }

        .signature-label {
            font-size: 0.9em;
            margin-bottom: 6px;
        }

        .signature-image {
            display: block;
            width: 100%;
            max-width: 320px;
            height: 42px;
            object-fit: contain;
            margin-bottom: 6px;
        }

        .signature-image.right {
            margin-left: auto;
        }

        .signature-line {
            border-top: 1px solid #111827;
            width: 100%;
            max-width: 320px;
            height: 1px;
            display: block;
        }

        .signature-line.right {
            margin-left: auto;
        }

        .page-footer {
            position: fixed;
            left: 18px;
            right: 18px;
            bottom: 18px;
        }
    </style>
</head>

<body>
    <div class="wrapper">
        <div class="header">
            @if ($heading !== '')
                <div class="header-title">{{ $heading }}</div>
            @endif

            @if ($companyName !== '' || $payPeriod !== '')
                <div class="header-sub">
                    @if ($companyName !== '')
                        {{ $companyName }}
                        @if ($payPeriod !== '')
                            &mdash;
                        @endif
                    @endif
                    @if ($payPeriod !== '')
                        Period: {{ $payPeriod }}
                    @endif
                </div>
            @endif

            @if (!empty($companyAddressLines))
                <div class="header-sub">
                    @foreach ($companyAddressLines as $line)
                        {{ $line }}@if (!$loop->last)
                            <br>
                        @endif
                    @endforeach
                </div>
            @endif
        </div>

        <table class="grid">
            @for ($i = 0; $i < $infoRows; $i++)
                @php
                    $left = $payslipRows[$i] ?? null;
                    $right = $employeeRows[$i] ?? null;
                    $leftLabel = $left['label'] ?? '';
                    $rightLabel = $right['label'] ?? '';
                @endphp

                @if ($leftLabel !== '' || $rightLabel !== '')
                    <tr>
                        <th>{{ $leftLabel }}</th>
                        <td>
                            @if ($leftLabel !== '')
                                {{ $left['value'] ?? '' }}
                            @endif
                        </td>

                        <th>{{ $rightLabel }}</th>
                        <td>
                            @if ($rightLabel !== '')
                                {{ $right['value'] ?? '' }}
                            @endif
                        </td>
                    </tr>
                @endif
            @endfor
        </table>

        <table class="grid">
            <tr>
                <th colspan="2">Earnings</th>
                <th colspan="2">Deductions</th>
            </tr>
            <tr>
                <th>Description</th>
                <th class="text-right">Amount</th>
                <th>Description</th>
                <th class="text-right">Amount</th>
            </tr>

            @if ($maxRows > 0)
                @for ($i = 0; $i < $maxRows; $i++)
                    @php
                        $earning = $earnings[$i] ?? null;
                        $deduction = $deductions[$i] ?? null;
                    @endphp
                    <tr>
                        <td>{{ $earning['label'] ?? '' }}</td>
                        <td class="text-right">
                            @if (isset($earning['amount']))
                                {{ $formatCurrency($earning['amount'] ?? 0) }}
                            @endif
                        </td>
                        <td>{{ $deduction['label'] ?? '' }}</td>
                        <td class="text-right">
                            @if (isset($deduction['amount']))
                                {{ $formatCurrency($deduction['amount'] ?? 0) }}
                            @endif
                        </td>
                    </tr>
                @endfor
            @else
                <tr>
                    <td>Basic Salary</td>
                    <td class="text-right">{{ $formatCurrency($basic) }}</td>
                    <td>Deductions</td>
                    <td class="text-right">{{ $formatCurrency($deductionAmount) }}</td>
                </tr>
                <tr>
                    <td>Allowances</td>
                    <td class="text-right">{{ $formatCurrency($allowance) }}</td>
                    <td></td>
                    <td></td>
                </tr>
            @endif

            <tr class="summary-row">
                <th>Total Earnings</th>
                <th class="text-right">{{ $formatCurrency($totalEarnings) }}</th>
                <th>Total Deductions</th>
                <th class="text-right">{{ $formatCurrency($totalDeductions) }}</th>
            </tr>
            <tr class="summary-row">
                <th colspan="2"></th>
                <th>Net Salary</th>
                <th class="text-right">{{ $formatCurrency($netSalary) }}</th>
            </tr>
        </table>

        @if ($showNetPayInWords && ! empty($netPayInWords))
            <p class="muted" style="margin-top: 10px;">
                <strong>Net Pay in words:</strong> {{ $netPayInWords }}
            </p>
        @endif

        @if ($hasEmployerSignature || $hasEmployeeSignature || ! empty($is_preview))
            <div class="page-footer">
                @if ($hasEmployerSignature || $hasEmployeeSignature)
                    <table class="signature-grid">
                        <tr>
                            @if ($hasEmployerSignature)
                                <td class="signature-cell">
                                    <div class="signature-label">Employer Signature</div>
                                    <img class="signature-image" src="{{ $employerSignature }}" alt="Employer Signature">
                                    <div class="signature-line"></div>
                                </td>
                            @endif
                            @if ($hasEmployeeSignature)
                                <td class="signature-cell" style="text-align: right;">
                                    <div class="signature-label">Employee Signature</div>
                                    <img class="signature-image right" src="{{ $employeeSignature }}" alt="Employee Signature">
                                    <div class="signature-line right"></div>
                                </td>
                            @endif
                        </tr>
                    </table>
                @endif

                @if (! empty($is_preview))
                    <p class="muted">This is a system generated salary slip.</p>
                @endif
            </div>
        @endif
    </div>
</body>

</html>
