<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use App\Models\User;
use App\Models\UserSetting;
use App\Models\SalarySlip;
use App\Models\Tax;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SalarySlipController extends Controller
{
    private function requireSalarySlipOwner(SalarySlip $salarySlip): void
    {
        $userId = Auth::id();

        if (! $userId || (int) $salarySlip->user_id !== (int) $userId) {
            abort(404);
        }
    }

    private function normalizeStoredSignaturePath($value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);
        if ($value === '') {
            return null;
        }

        if (str_starts_with($value, 'data:image/')) {
            return $value;
        }

        $path = $value;
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            $urlPath = parse_url($value, PHP_URL_PATH);
            if (is_string($urlPath) && $urlPath !== '') {
                $path = $urlPath;
            }
        }

        if (! is_string($path) || trim($path) === '') {
            return null;
        }

        return '/' . ltrim($path, '/');
    }

    private function resolveSettingsDefaults(?User $user): array
    {
        $ttlSeconds = 300;
        $settingsKeys = [
            'company_name',
            'company_address',
            'date_format',
            'time_format',
            'default_currency',
            'currency_symbol_position',
        ];

        $userSettings = $user
            ? Cache::remember(
                "user_settings:{$user->id}:salary_slip_defaults",
                $ttlSeconds,
                fn () => UserSetting::getKeysForUser($user->id, $settingsKeys),
            )
            : [];

        $adminId = null;
        if ($user && $user->relationLoaded('roles') && $user->roles->contains('slug', 'admin')) {
            $adminId = $user->id;
        } else {
            $adminId = Cache::remember(
                'user_settings:admin_id',
                $ttlSeconds,
                fn () => User::query()
                    ->whereHas('roles', function ($query) {
                        $query->where('slug', 'admin');
                    })
                    ->orderBy('id')
                    ->value('id'),
            );
        }

        $adminSettings = $adminId
            ? Cache::remember(
                'user_settings:' . ((int) $adminId) . ':salary_slip_defaults',
                $ttlSeconds,
                fn () => UserSetting::getKeysForUser((int) $adminId, $settingsKeys),
            )
            : [];

        return array_merge($adminSettings, $userSettings);
    }

    private function signatureSrcForPdf($value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);
        if ($value === '') {
            return null;
        }

        if (str_starts_with($value, 'data:image/')) {
            return $value;
        }

        $path = null;

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            $urlPath = parse_url($value, PHP_URL_PATH);
            if (is_string($urlPath) && $urlPath !== '') {
                $path = $urlPath;
            }
        } else {
            $path = $value;
        }

        if (! is_string($path) || $path === '') {
            return $value;
        }

        $path = '/' . ltrim($path, '/');

        if (str_starts_with($path, '/storage/')) {
            $diskPath = ltrim(Str::after($path, '/storage/'), '/');

            if (Storage::disk('public')->exists($diskPath)) {
                $data = Storage::disk('public')->get($diskPath);
                if (is_string($data) && $data !== '') {
                    $mime = null;
                    $fullDiskPath = Storage::disk('public')->path($diskPath);
                    if (is_string($fullDiskPath) && is_file($fullDiskPath)) {
                        $maybeMime = mime_content_type($fullDiskPath);
                        if (is_string($maybeMime) && $maybeMime !== '') {
                            $mime = $maybeMime;
                        }
                    }
                    if (! is_string($mime) || $mime === '') {
                        $mime = 'image/png';
                    }

                    return 'data:' . $mime . ';base64,' . base64_encode($data);
                }
            }

            $fullPath = public_path(ltrim($path, '/'));
            if (is_file($fullPath)) {
                $mime = mime_content_type($fullPath);
                if (! is_string($mime) || $mime === '') {
                    $mime = 'image/png';
                }
                $data = file_get_contents($fullPath);
                if (is_string($data) && $data !== '') {
                    return 'data:' . $mime . ';base64,' . base64_encode($data);
                }
            }
        }

        return $value;
    }

    private function prepareSalarySlipForPdf(SalarySlip $salarySlip): SalarySlip
    {
        $meta = $salarySlip->meta ?? [];
        if (! is_array($meta)) {
            $meta = [];
        }

        $meta = $this->applyTaxLabelsToDeductions($meta);

        $legacyShow = $meta['show_signatures_in_pdf'] ?? true;
        $legacyShow = ! ($legacyShow === false || $legacyShow === 0 || $legacyShow === '0');

        $showEmployer = $meta['show_employer_signature_in_pdf'] ?? null;
        if ($showEmployer === null || $showEmployer === '') {
            $showEmployer = $legacyShow;
        } else {
            $showEmployer = ! ($showEmployer === false || $showEmployer === 0 || $showEmployer === '0');
        }

        $showEmployee = $meta['show_employee_signature_in_pdf'] ?? null;
        if ($showEmployee === null || $showEmployee === '') {
            $showEmployee = $legacyShow;
        } else {
            $showEmployee = ! ($showEmployee === false || $showEmployee === 0 || $showEmployee === '0');
        }

        if (! $showEmployer) {
            $meta['employer_signature'] = null;
        }
        if (! $showEmployee) {
            $meta['employee_signature'] = null;
        }

        if (! $showEmployer && ! $showEmployee) {
            $salarySlip->meta = $meta;

            return $salarySlip;
        }

        if (array_key_exists('employer_signature', $meta)) {
            $meta['employer_signature'] = $this->signatureSrcForPdf($meta['employer_signature']);
        }
        if (array_key_exists('employee_signature', $meta)) {
            $meta['employee_signature'] = $this->signatureSrcForPdf($meta['employee_signature']);
        }

        $salarySlip->meta = $meta;

        return $salarySlip;
    }

    private function applyTaxLabelsToDeductions(array $meta): array
    {
        $deductions = $meta['deductions'] ?? [];
        if (! is_array($deductions)) {
            return $meta;
        }

        $taxIds = [];
        foreach ($deductions as $row) {
            if (! is_array($row)) {
                continue;
            }
            $taxId = $row['tax_id'] ?? null;
            if ($taxId === null || $taxId === '') {
                continue;
            }
            $taxIds[] = (int) $taxId;
        }

        $taxIds = array_values(array_unique(array_filter($taxIds)));
        if (count($taxIds) === 0) {
            return $meta;
        }

        $taxesById = Tax::where('user_id', Auth::id())
            ->whereIn('id', $taxIds)
            ->get()
            ->keyBy('id');

        foreach ($deductions as $i => $row) {
            if (! is_array($row)) {
                continue;
            }

            $taxId = $row['tax_id'] ?? null;
            if ($taxId === null || $taxId === '') {
                continue;
            }

            $tax = $taxesById->get((int) $taxId);
            if (! $tax) {
                continue;
            }
            $nameLabel = trim((string) ($tax->name ?? ''));
            if ($nameLabel === '') {
                continue;
            }

            if ((string) $tax->type === 'percentage') {
                $valueLabel = (float) ($tax->value ?? 0);
                $valueLabel = rtrim(rtrim(number_format($valueLabel, 2, '.', ''), '0'), '.');
                $deductions[$i]['label'] = $nameLabel . ' (' . $valueLabel . '%)';
            } else {
                $deductions[$i]['label'] = $nameLabel;
            }
        }

        $meta['deductions'] = $deductions;

        return $meta;
    }

    private function storeSignatureDataUrl(string $dataUrl, string $prefix): ?string
    {
        $dataUrl = trim($dataUrl);
        if ($dataUrl === '') {
            return null;
        }

        if (! str_starts_with($dataUrl, 'data:image/')) {
            return null;
        }

        if (! preg_match('#^data:image/(png|jpe?g);base64,#i', $dataUrl, $m)) {
            return null;
        }

        $ext = strtolower($m[1] ?? 'png');
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }

        $base64 = preg_replace('#^data:image/[^;]+;base64,#i', '', $dataUrl);
        if (! is_string($base64) || $base64 === '') {
            return null;
        }

        $binary = base64_decode($base64, true);
        if ($binary === false) {
            return null;
        }

        $path = 'signatures/' . $prefix . '-' . uniqid('', true) . '.' . $ext;
        Storage::disk('public')->put($path, $binary);

        return '/storage/' . ltrim($path, '/');
    }

    private function handleSignatureUploads(Request $request, array $meta): array
    {
        if ($request->hasFile('employer_signature_file')) {
            $path = $request->file('employer_signature_file')
                ->store('signatures', 'public');
            $meta['employer_signature'] = '/storage/' . ltrim($path, '/');
        } elseif (! empty($meta['employer_signature']) && is_string($meta['employer_signature'])) {
            $stored = $this->storeSignatureDataUrl($meta['employer_signature'], 'employer');
            if ($stored) {
                $meta['employer_signature'] = $stored;
            } else {
                $normalized = $this->normalizeStoredSignaturePath($meta['employer_signature']);
                if ($normalized) {
                    $meta['employer_signature'] = $normalized;
                }
            }
        }

        if ($request->hasFile('employee_signature_file')) {
            $path = $request->file('employee_signature_file')
                ->store('signatures', 'public');
            $meta['employee_signature'] = '/storage/' . ltrim($path, '/');
        } elseif (! empty($meta['employee_signature']) && is_string($meta['employee_signature'])) {
            $stored = $this->storeSignatureDataUrl($meta['employee_signature'], 'employee');
            if ($stored) {
                $meta['employee_signature'] = $stored;
            } else {
                $normalized = $this->normalizeStoredSignaturePath($meta['employee_signature']);
                if ($normalized) {
                    $meta['employee_signature'] = $normalized;
                }
            }
        }

        return $meta;
    }

    private function normalizeMeta(array $meta): array
    {
        $payslipFields = $meta['payslip_fields'] ?? [];
        $employeeFields = $meta['employee_fields'] ?? [];

        unset($meta['payslip_fields'], $meta['employee_fields']);

        $payslipLabels = [];
        if (is_array($payslipFields)) {
            foreach ($payslipFields as $item) {
                if (! is_array($item)) {
                    continue;
                }

                $key = trim((string) ($item['key'] ?? ''));
                $label = trim((string) ($item['label'] ?? ''));
                $value = $item['value'] ?? null;

                if ($key === '' || $label === '') {
                    continue;
                }

                $payslipLabels[$key] = $label;
                $meta[$key] = $value;
            }
        }

        $employeeLabels = [];
        if (is_array($employeeFields)) {
            foreach ($employeeFields as $item) {
                if (! is_array($item)) {
                    continue;
                }

                $key = trim((string) ($item['key'] ?? ''));
                $label = trim((string) ($item['label'] ?? ''));
                $value = $item['value'] ?? null;

                if ($key === '' || $label === '') {
                    continue;
                }

                $employeeLabels[$key] = $label;
                $meta[$key] = $value;
            }
        }

        if (! empty($payslipLabels)) {
            $meta['payslip_labels'] = $payslipLabels;
        }
        if (! empty($employeeLabels)) {
            $meta['employee_labels'] = $employeeLabels;
        }

        $payslipExtra = $meta['payslip_extra'] ?? [];
        if (! is_array($payslipExtra)) {
            $payslipExtra = [];
        }
        $payslipExtra = array_values(array_filter($payslipExtra, function ($item) {
            if (! is_array($item)) {
                return false;
            }

            return trim((string) ($item['label'] ?? '')) !== '';
        }));
        $meta['payslip_extra'] = $payslipExtra;

        $employeeExtra = $meta['employee_extra'] ?? [];
        if (! is_array($employeeExtra)) {
            $employeeExtra = [];
        }
        $employeeExtra = array_values(array_filter($employeeExtra, function ($item) {
            if (! is_array($item)) {
                return false;
            }

            return trim((string) ($item['label'] ?? '')) !== '';
        }));
        $meta['employee_extra'] = $employeeExtra;

        $earnings = $meta['earnings'] ?? [];
        if (! is_array($earnings)) {
            $earnings = [];
        }
        $earnings = array_values(array_filter($earnings, function ($item) {
            if (! is_array($item)) {
                return false;
            }

            return trim((string) ($item['label'] ?? '')) !== '';
        }));
        $meta['earnings'] = $earnings;

        $deductions = $meta['deductions'] ?? [];
        if (! is_array($deductions)) {
            $deductions = [];
        }
        $deductions = array_values(array_filter($deductions, function ($item) {
            if (! is_array($item)) {
                return false;
            }

            $label = trim((string) ($item['label'] ?? ''));
            $taxId = $item['tax_id'] ?? null;
            $hasTax = $taxId !== null && $taxId !== '';

            return $label !== '' || $hasTax;
        }));
        $meta['deductions'] = $deductions;

        return $meta;
    }

    private function totalEarningsFromMeta(array $meta): float
    {
        $earnings = $meta['earnings'] ?? [];
        if (! is_array($earnings)) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($earnings as $row) {
            if (! is_array($row)) {
                continue;
            }
            $amount = (float) ($row['amount'] ?? 0);
            $sum += $amount;
        }

        return $sum;
    }

    private function applyTaxesToDeductions(array $meta): array
    {
        $deductions = $meta['deductions'] ?? [];
        if (! is_array($deductions)) {
            return $meta;
        }

        $taxIds = [];
        foreach ($deductions as $row) {
            if (! is_array($row)) {
                continue;
            }

            $taxId = $row['tax_id'] ?? null;
            if ($taxId === null || $taxId === '') {
                continue;
            }
            $taxIds[] = (int) $taxId;
        }

        $taxIds = array_values(array_unique(array_filter($taxIds)));
        if (count($taxIds) === 0) {
            return $meta;
        }

        $taxesById = Tax::where('user_id', Auth::id())
            ->whereIn('id', $taxIds)
            ->get()
            ->keyBy('id');
        $totalEarnings = $this->totalEarningsFromMeta($meta);

        foreach ($deductions as $i => $row) {
            if (! is_array($row)) {
                continue;
            }

            $taxId = $row['tax_id'] ?? null;
            if ($taxId === null || $taxId === '') {
                continue;
            }

            $tax = $taxesById->get((int) $taxId);
            if (! $tax) {
                continue;
            }

            $amount = 0.0;
            if ($tax->type === 'percentage') {
                $amount = ($totalEarnings * (float) $tax->value) / 100;
            } else {
                $amount = (float) $tax->value;
            }

            $nameLabel = trim((string) ($tax->name ?? ''));
            if ($nameLabel !== '') {
                if ((string) $tax->type === 'percentage') {
                    $valueLabel = (float) ($tax->value ?? 0);
                    $valueLabel = rtrim(rtrim(number_format($valueLabel, 2, '.', ''), '0'), '.');
                    $deductions[$i]['label'] = $nameLabel . ' (' . $valueLabel . '%)';
                } else {
                    $deductions[$i]['label'] = $nameLabel;
                }
            }
            $deductions[$i]['amount'] = round($amount, 2);
        }

        $meta['deductions'] = $deductions;

        return $meta;
    }

    private function totalDeductionsFromMeta(array $meta): float
    {
        $deductions = $meta['deductions'] ?? [];
        if (! is_array($deductions)) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($deductions as $row) {
            if (! is_array($row)) {
                continue;
            }
            $amount = (float) ($row['amount'] ?? 0);
            $sum += $amount;
        }

        return $sum;
    }

    public function index(Request $request)
    {
        $allowedPerPage = [5, 10, 15, 20, 25];
        $perPage = (int) $request->query('per_page', 10);
        if (! in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $salarySlips = SalarySlip::with('template')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate($perPage)
            ->appends($request->query());

        return Inertia::render('salary-slip/index', [
            'salarySlips' => $salarySlips,
        ]);
    }

    public function create()
    {
        $templates = DocumentTemplate::where('document_type', 'salary_slip')
            ->where('user_id', Auth::id())
            ->active()
            ->orderBy('name')
            ->get();

        $taxes = Tax::where('user_id', Auth::id())->active()->orderBy('name')->get();

        return Inertia::render('salary-slip/create', [
            'templates' => $templates,
            'taxes' => $taxes,
        ]);
    }

    public function store(Request $request)
    {
        $userId = $request->user()->id;

        $data = $request->validate([
            'document_template_id' => [
                'required',
                Rule::exists('document_templates', 'id')
                    ->where(function ($query) use ($userId) {
                        $query->where('user_id', $userId)->where('document_type', 'salary_slip');
                    }),
            ],
            'basic_salary' => 'required|numeric',
            'allowance_amount' => 'required|numeric',
            'deduction_amount' => 'required|numeric',
            'meta' => 'nullable|array',

            'meta.heading' => 'nullable|string|max:255',
            'meta.company_name' => 'nullable|string|max:255',
            'meta.company_address' => 'nullable|string',

            'meta.employer_signature' => 'nullable|string',
            'meta.employee_signature' => 'nullable|string',

            'meta.show_signatures_in_pdf' => 'nullable|boolean',
            'meta.show_employer_signature_in_pdf' => 'nullable|boolean',
            'meta.show_employee_signature_in_pdf' => 'nullable|boolean',

            'meta.net_pay_in_words' => 'nullable|string|max:255',
            'meta.show_net_pay_in_words' => 'nullable|boolean',

            'meta.payslip_fields' => 'nullable|array',
            'meta.payslip_fields.*.key' => 'nullable|string|max:255',
            'meta.payslip_fields.*.label' => 'nullable|string|max:255',
            'meta.payslip_fields.*.value' => 'nullable|string|max:255',

            'meta.employee_fields' => 'nullable|array',
            'meta.employee_fields.*.key' => 'nullable|string|max:255',
            'meta.employee_fields.*.label' => 'nullable|string|max:255',
            'meta.employee_fields.*.value' => 'nullable|string|max:255',

            'meta.earnings' => 'nullable|array',
            'meta.earnings.*.label' => 'nullable|string|max:255',
            'meta.earnings.*.amount' => 'nullable|numeric',

            'meta.deductions' => 'nullable|array',
            'meta.deductions.*.label' => 'nullable|string|max:255',
            'meta.deductions.*.amount' => 'nullable|numeric',
            'meta.deductions.*.tax_id' => [
                'nullable',
                Rule::exists('taxes', 'id')->where(function ($query) use ($userId) {
                    $query->where('user_id', $userId);
                }),
            ],

            'employer_signature_file' => 'nullable|file|image|mimes:jpg,jpeg,png,webp|max:4096',
            'employee_signature_file' => 'nullable|file|image|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        $meta = $request->input('meta', []);
        if (! is_array($meta)) {
            $meta = [];
        }

        $data['meta'] = $this->normalizeMeta($meta);
        $data['meta'] = $this->handleSignatureUploads($request, $data['meta']);
        $data['meta'] = $this->applyTaxesToDeductions($data['meta']);

        $basic = (float) ($data['basic_salary'] ?? 0);
        $allowance = (float) ($data['allowance_amount'] ?? 0);

        $deduction = $this->totalDeductionsFromMeta($data['meta']);
        $data['deduction_amount'] = $deduction;

        $data['net_salary'] = $basic + $allowance - $deduction;

        $data['user_id'] = $userId;

        SalarySlip::create($data);

        return redirect()->route('salary-slip.index');
    }

    public function preview(Request $request)
    {
        $userId = $request->user()->id;
        $templateId = $request->input('document_template_id');
        if (! $templateId) {
            return response('Please select a template.', 422);
        }

        $template = DocumentTemplate::where('document_type', 'salary_slip')
            ->where('user_id', $userId)
            ->whereKey($templateId)
            ->first();

        if (! $template) {
            return response('Template not found.', 404);
        }

        $view = 'app.salary_slip.pdf_templates.' . $template->code;
        if (! view()->exists($view)) {
            return response('Template view not found: ' . e($view), 404);
        }

        $basic = (float) ($request->input('basic_salary') ?: 0);
        $allowance = (float) ($request->input('allowance_amount') ?: 0);

        $deduction = (float) ($request->input('deduction_amount') ?: 0);

        $meta = $request->input('meta', []);
        if (! is_array($meta)) {
            $meta = [];
        }

        $meta = $this->normalizeMeta($meta);
        $meta = $this->handleSignatureUploads($request, $meta);
        $meta = $this->applyTaxesToDeductions($meta);
        $deduction = $this->totalDeductionsFromMeta($meta);

        $salarySlip = new SalarySlip([
            'basic_salary' => $basic,
            'allowance_amount' => $allowance,
            'deduction_amount' => $deduction,
            'net_salary' => $basic + $allowance - $deduction,
            'meta' => $meta,
        ]);

        return response()->view($view, [
            'salarySlip' => $salarySlip,
            'template' => $template,
            'is_preview' => true,
        ]);
    }

    public function edit(SalarySlip $salarySlip)
    {
        $this->requireSalarySlipOwner($salarySlip);

        $templates = DocumentTemplate::where('document_type', 'salary_slip')
            ->where('user_id', Auth::id())
            ->active()
            ->orderBy('name')
            ->get();

        $taxes = Tax::where('user_id', Auth::id())->active()->orderBy('name')->get();

        return Inertia::render('salary-slip/edit', [
            'salarySlip' => $salarySlip->loadMissing('template'),
            'templates' => $templates,
            'taxes' => $taxes,
        ]);
    }

    public function show(Request $request, SalarySlip $salarySlip)
    {
        $this->requireSalarySlipOwner($salarySlip);

        $salarySlip->loadMissing('template');

        $meta = $salarySlip->meta ?? [];
        if (! is_array($meta)) {
            $meta = [];
        }
        $salarySlip->meta = $this->applyTaxLabelsToDeductions($meta);

        return Inertia::render('salary-slip/show', [
            'salarySlip' => $salarySlip,
            'settingsDefaults' => $this->resolveSettingsDefaults($request->user()),
        ]);
    }

    public function update(Request $request, SalarySlip $salarySlip)
    {
        $this->requireSalarySlipOwner($salarySlip);
        $userId = $request->user()->id;

        $data = $request->validate([
            'document_template_id' => [
                'required',
                Rule::exists('document_templates', 'id')
                    ->where(function ($query) use ($userId) {
                        $query->where('user_id', $userId)->where('document_type', 'salary_slip');
                    }),
            ],
            'basic_salary' => 'required|numeric',
            'allowance_amount' => 'required|numeric',
            'deduction_amount' => 'required|numeric',
            'meta' => 'nullable|array',

            'meta.heading' => 'nullable|string|max:255',
            'meta.company_name' => 'nullable|string|max:255',
            'meta.company_address' => 'nullable|string',

            'meta.employer_signature' => 'nullable|string',
            'meta.employee_signature' => 'nullable|string',

            'meta.show_signatures_in_pdf' => 'nullable|boolean',
            'meta.show_employer_signature_in_pdf' => 'nullable|boolean',
            'meta.show_employee_signature_in_pdf' => 'nullable|boolean',

            'meta.net_pay_in_words' => 'nullable|string|max:255',
            'meta.show_net_pay_in_words' => 'nullable|boolean',

            'meta.payslip_fields' => 'nullable|array',
            'meta.payslip_fields.*.key' => 'nullable|string|max:255',
            'meta.payslip_fields.*.label' => 'nullable|string|max:255',
            'meta.payslip_fields.*.value' => 'nullable|string|max:255',

            'meta.employee_fields' => 'nullable|array',
            'meta.employee_fields.*.key' => 'nullable|string|max:255',
            'meta.employee_fields.*.label' => 'nullable|string|max:255',
            'meta.employee_fields.*.value' => 'nullable|string|max:255',

            'meta.earnings' => 'nullable|array',
            'meta.earnings.*.label' => 'nullable|string|max:255',
            'meta.earnings.*.amount' => 'nullable|numeric',

            'meta.deductions' => 'nullable|array',
            'meta.deductions.*.label' => 'nullable|string|max:255',
            'meta.deductions.*.amount' => 'nullable|numeric',
            'meta.deductions.*.tax_id' => [
                'nullable',
                Rule::exists('taxes', 'id')->where(function ($query) use ($userId) {
                    $query->where('user_id', $userId);
                }),
            ],

            'employer_signature_file' => 'nullable|file|image|mimes:jpg,jpeg,png,webp|max:4096',
            'employee_signature_file' => 'nullable|file|image|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        if ($request->exists('meta')) {
            $meta = $request->input('meta', []);
            if (! is_array($meta)) {
                $meta = [];
            }

            $data['meta'] = $this->normalizeMeta($meta);
            $data['meta'] = $this->handleSignatureUploads($request, $data['meta']);
            $data['meta'] = $this->applyTaxesToDeductions($data['meta']);
        }

        $basic = (float) ($data['basic_salary'] ?? 0);
        $allowance = (float) ($data['allowance_amount'] ?? 0);

        if (array_key_exists('meta', $data) && is_array($data['meta'])) {
            $deduction = $this->totalDeductionsFromMeta($data['meta']);
            $data['deduction_amount'] = $deduction;
        } else {
            $deduction = (float) ($data['deduction_amount'] ?? 0);
        }

        $data['net_salary'] = $basic + $allowance - $deduction;

        $salarySlip->update($data);

        return redirect()->route('salary-slip.index');
    }

    public function destroy(SalarySlip $salarySlip)
    {
        $this->requireSalarySlipOwner($salarySlip);

        $salarySlip->delete();

        return redirect()->route('salary-slip.index');
    }

    public function showPdf(Request $request, SalarySlip $salarySlip)
    {
        $this->requireSalarySlipOwner($salarySlip);

        if (! class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            abort(500, 'PDF library is not installed. Run composer require barryvdh/laravel-dompdf');
        }

        $salarySlip->loadMissing('template');
        $salarySlip = $this->prepareSalarySlipForPdf($salarySlip);

        if (! $salarySlip->template || ! $salarySlip->template->code) {
            abort(500, 'Salary slip template is not configured.');
        }

        $view = 'app.salary_slip.pdf_templates.' . $salarySlip->template->code;

        if (! view()->exists($view)) {
            abort(500, 'Salary slip template view not found: ' . $view);
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView($view, [
            'salarySlip' => $salarySlip,
            'template' => $salarySlip->template,
            'settingsDefaults' => $this->resolveSettingsDefaults($request->user()),
        ]);

        return $pdf->stream('salary-slip-' . $salarySlip->id . '.pdf');
    }

    public function downloadPdf(Request $request, SalarySlip $salarySlip)
    {
        $this->requireSalarySlipOwner($salarySlip);

        if (! class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            abort(500, 'PDF library is not installed. Run composer require barryvdh/laravel-dompdf');
        }

        $salarySlip->loadMissing('template');
        $salarySlip = $this->prepareSalarySlipForPdf($salarySlip);

        if (! $salarySlip->template || ! $salarySlip->template->code) {
            abort(500, 'Salary slip template is not configured.');
        }

        $view = 'app.salary_slip.pdf_templates.' . $salarySlip->template->code;

        if (! view()->exists($view)) {
            abort(500, 'Salary slip template view not found: ' . $view);
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView($view, [
            'salarySlip' => $salarySlip,
            'template' => $salarySlip->template,
            'settingsDefaults' => $this->resolveSettingsDefaults($request->user()),
        ]);

        return $pdf->download('salary-slip-' . $salarySlip->id . '.pdf');
    }
}
