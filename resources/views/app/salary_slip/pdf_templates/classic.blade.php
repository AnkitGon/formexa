@php
    $primaryColor = $template->primary_color ?? '#000000';
    $accentColor = $template->accent_color ?? '#000000';
    $textColor = $template->secondary_color ?? '#000000';
    $fontFamily = trim((string) ($template->font_family ?? ''));
    if ($fontFamily === '') {
        $fontFamily = 'Arial, sans-serif';
    }
    $fontSize = $template->font_size ?? 12;
    $lineHeight = $template->line_height ?? (int) round($fontSize * 1.4);

    $meta = $salarySlip->meta ?? [];
    if (! is_array($meta)) {
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

    $payslipLabels = $meta['payslip_labels'] ?? [];
    $employeeLabels = $meta['employee_labels'] ?? [];
    $payslipExtra = $meta['payslip_extra'] ?? [];
    $employeeExtra = $meta['employee_extra'] ?? [];

    if (! is_array($payslipLabels)) {
        $payslipLabels = [];
    }
    if (! is_array($employeeLabels)) {
        $employeeLabels = [];
    }
    if (! is_array($payslipExtra)) {
        $payslipExtra = [];
    }
    if (! is_array($employeeExtra)) {
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

    $formatCurrency = function ($value) use ($defaultCurrency, $currencySymbolPosition) {
        $amount = (float) ($value ?? 0);
        $base = number_format($amount, 2);
        // Use currency code to avoid unsupported glyphs
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

    $earnings = $meta['earnings'] ?? [];
    $deductions = $meta['deductions'] ?? [];

    if (! is_array($earnings)) {
        $earnings = [];
    }
    if (! is_array($deductions)) {
        $deductions = [];
    }

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
    <title>Salary Slip #{{ $salarySlip->id }} - Classic</title>
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
            padding-bottom: 190px;
            box-sizing: border-box;
        }

        .title {
            text-align: center;
            font-weight: bold;
            font-size: 1.5em;
            margin-bottom: 4px;
        }

        .company {
            text-align: center;
            font-size: 1.1em;
            margin-bottom: 2px;
        }

        .address {
            text-align: center;
            font-size: 0.95em;
            margin-bottom: 16px;
        }

        .info-table {
            width: 100%;
            font-size: 0.95em;
            margin-bottom: 18px;
            border-collapse: collapse;
        }

        .info-table td {
            padding: 2px 4px;
        }

        .info-label {
            width: 25%;
        }

        .info-value {
            width: 25%;
        }

        .pay-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.95em;
            margin-bottom: 24px;
        }

        .pay-table th {
            padding: 4px 6px;
            border: 1px solid {{ $accentColor }};
            background-color: {{ $primaryColor }};
            color: #ffffff;
        }

        .pay-table td {
            padding: 4px 6px;
            border: 1px solid {{ $accentColor }};
        }

        .text-right {
            text-align: right;
        }

        .total-row th,
        .total-row td {
            font-weight: bold;
        }

        .netpay-block {
            text-align: center;
            margin: 16px 0 32px 0;
            font-size: 1em;
        }

        .netpay-number {
            margin-bottom: 4px;
        }

        .netpay-words {
            font-size: 0.95em;
        }

        .signature-table {
            width: 100%;
            font-size: 0.95em;
            border-collapse: separate;
            border-spacing: 60px 22px;
        }

        .signature-table td {
            padding: 0 4px;
        }

        .signature-label {
            padding-bottom: 50px;
        }

        .signature-line-cell {
            padding-top: 28px;
        }

        .signature-line {
            border-top: 1px solid #000000;
            height: 1px;
            width: 100%;
            max-width: 320px;
            display: block;
        }

        .signature-line.right {
            margin-left: auto;
        }

        .signature-image {
            display: block;
            height: 42px;
            max-width: 320px;
            width: 100%;
            object-fit: contain;
            margin-bottom: 6px;
        }

        .signature-image.right {
            margin-left: auto;
        }

        .footer-note {
            text-align: center;
            margin-top: 30px;
            font-size: 10px;
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
        @if ($heading !== '')
            <div class="title">{{ $heading }}</div>
        @endif

        @if ($companyName !== '')
            <div class="company">{{ $companyName }}</div>
        @endif

        @if (!empty($companyAddressLines))
            <div class="address">
                @foreach ($companyAddressLines as $line)
                    {{ $line }}@if (!$loop->last)
                        <br>
                    @endif
                @endforeach
            </div>
        @endif

        <table class="info-table">
            @for ($i = 0; $i < $infoRows; $i++)
                @php
                    $left = $payslipRows[$i] ?? null;
                    $right = $employeeRows[$i] ?? null;
                    $leftLabel = $left['label'] ?? '';
                    $rightLabel = $right['label'] ?? '';
                @endphp

                @if ($leftLabel !== '' || $rightLabel !== '')
                    <tr>
                        <td class="info-label">{{ $leftLabel }}</td>
                        <td class="info-value">
                            @if ($leftLabel !== '')
                                : {{ $left['display'] ?? $left['value'] ?? '' }}
                            @endif
                        </td>

                        <td class="info-label">{{ $rightLabel }}</td>
                        <td class="info-value">
                            @if ($rightLabel !== '')
                                : {{ $right['display'] ?? $right['value'] ?? '' }}
                            @endif
                        </td>
                    </tr>
                @endif
            @endfor
        </table>

        <table class="pay-table">
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
                    <td>Basic</td>
                    <td class="text-right">{{ $formatCurrency($basic) }}</td>
                    <td>Deductions</td>
                    <td class="text-right">{{ $formatCurrency($deductionAmount) }}</td>
                </tr>
                <tr>
                    <td>Allowance</td>
                    <td class="text-right">{{ $formatCurrency($allowance) }}</td>
                    <td></td>
                    <td></td>
                </tr>
            @endif

            <tr class="total-row">
                <td>Total Earnings</td>
                <td class="text-right">{{ $formatCurrency($totalEarnings) }}</td>
                <td>Total Deductions</td>
                <td class="text-right">{{ $formatCurrency($totalDeductions) }}</td>
            </tr>
            <tr class="total-row">
                <td colspan="2"></td>
                <td>Net Salary</td>
                <td class="text-right">{{ $formatCurrency($netSalary) }}</td>
            </tr>
        </table>

        @if ($showNetPayInWords && ! empty($netPayInWords))
            <div class="netpay-block">
                <div class="netpay-number">Net Salary: {{ $formatCurrency($netSalary) }}</div>
                <div class="netpay-words">{{ $netPayInWords }}</div>
            </div>
        @endif

        @if ($hasEmployerSignature || $hasEmployeeSignature || ! empty($is_preview))
            <div class="page-footer">
                @if ($hasEmployerSignature || $hasEmployeeSignature)
                    <table class="signature-table">
                        <tr>
                            @if ($hasEmployerSignature)
                                <td class="signature-label">Employer Signature</td>
                            @endif
                            @if ($hasEmployeeSignature)
                                <td class="signature-label" style="text-align: right;">Employee Signature</td>
                            @endif
                        </tr>
                        <tr>
                            @if ($hasEmployerSignature)
                                <td class="signature-line-cell">
                                    <img class="signature-image" src="{{ $employerSignature }}" alt="Employer Signature">
                                    <div class="signature-line"></div>
                                </td>
                            @endif
                            @if ($hasEmployeeSignature)
                                <td class="signature-line-cell" style="text-align: right;">
                                    <img class="signature-image right" src="{{ $employeeSignature }}" alt="Employee Signature">
                                    <div class="signature-line right"></div>
                                </td>
                            @endif
                        </tr>
                    </table>
                @endif

                @if (! empty($is_preview))
                    <div class="footer-note">This is system generated payslip</div>
                @endif
            </div>
        @endif
    </div>
</body>

</html>
