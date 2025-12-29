<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\DocumentTemplate;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\SalarySlip;
use App\Models\UserSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TemplateController extends Controller
{
    private const MODULES = ['salary_slip', 'invoice'];

    private const DESIGN_OPTIONS = [
        'salary_slip' => [
            'classic' => 'Classic',
            'modern' => 'Modern',
        ],
        'invoice' => [
            'business' => 'Business',
            'retail' => 'Retail',
            'service' => 'Service',
            'tax-invoice' => 'Tax Invoice',
        ],
    ];

    public function index(Request $request)
    {
        $allowedPerPage = [5, 10, 15, 20, 25];
        $perPage = (int) $request->query('per_page', 10);
        if (! in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = DocumentTemplate::orderBy('name');
        $docType = $request->query('document_type');
        if ($docType && in_array($docType, self::MODULES, true)) {
            $query->where('document_type', $docType);
        }

        $templates = $query->paginate($perPage)->appends($request->query());

        $settings = UserSetting::getMapForUser($request->user()->id);

        return Inertia::render('templates/index', [
            'templates' => $templates,
            'designOptions' => self::DESIGN_OPTIONS['salary_slip'],
            'branding' => [
                'invoice_logo_url' => isset($settings['invoice_logo']) ? asset('storage/'.$settings['invoice_logo']) : null,
            ],
        ]);
    }

    public function create()
    {
        $settings = UserSetting::getMapForUser(request()->user()->id);

        return Inertia::render('templates/create', [
            'designOptions' => self::DESIGN_OPTIONS['salary_slip'],
            'branding' => [
                'invoice_logo_url' => isset($settings['invoice_logo']) ? asset('storage/'.$settings['invoice_logo']) : null,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $documentType = $request->input('document_type', 'salary_slip');
        $designOptions = self::DESIGN_OPTIONS[$documentType] ?? [];

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'document_type' => 'required|string|in:' . implode(',', self::MODULES),
            'code' => 'required|string|max:255|in:' . implode(',', array_keys($designOptions)) . '|unique:document_templates,code',
            'description' => 'nullable|string',
            'primary_color' => 'nullable|string|max:20',
            'secondary_color' => 'nullable|string|max:20',
            'accent_color' => 'nullable|string|max:20',
            'font_family' => 'nullable|string|max:100',
            'font_size' => 'nullable|integer|min:6|max:24',
            'line_height' => 'required|integer|min:10|max:40',
            'is_active' => 'sometimes|boolean',
            'show_logo' => 'nullable|boolean',
        ]);

        // Normalize font family to avoid nulls and preserve user selection
        $fontFamily = trim((string) $request->input('font_family', ''));
        $data['font_family'] = $fontFamily === '' ? null : $fontFamily;

        $data['is_active'] = $request->boolean('is_active', true);
        $data['show_logo'] = $request->boolean('show_logo', true);

        DocumentTemplate::create($data + ['user_id' => $request->user()->id]);

        return redirect()->route('template.index');
    }

    public function edit(DocumentTemplate $template)
    {
        $settings = UserSetting::getMapForUser(request()->user()->id);

        return Inertia::render('templates/edit', [
            'template' => $template,
            'designOptions' => self::DESIGN_OPTIONS['salary_slip'],
            'branding' => [
                'invoice_logo_url' => isset($settings['invoice_logo']) ? asset('storage/'.$settings['invoice_logo']) : null,
            ],
        ]);
    }

    public function update(Request $request, DocumentTemplate $template)
    {
        $documentType = $request->input('document_type', $template->document_type ?? 'salary_slip');
        $designOptions = self::DESIGN_OPTIONS[$documentType] ?? [];

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'document_type' => 'required|string|in:' . implode(',', self::MODULES),
            'code' => 'required|string|max:255|in:' . implode(',', array_keys($designOptions)) . '|unique:document_templates,code,' . $template->id,
            'description' => 'nullable|string',
            'primary_color' => 'nullable|string|max:20',
            'secondary_color' => 'nullable|string|max:20',
            'accent_color' => 'nullable|string|max:20',
            'font_family' => 'nullable|string|max:100',
            'font_size' => 'nullable|integer|min:6|max:24',
            'line_height' => 'nullable|integer|min:10|max:40',
            'is_active' => 'sometimes|boolean',
            'show_logo' => 'nullable|boolean',
        ]);

        // Normalize font family to avoid nulls and preserve user selection
        $fontFamily = trim((string) $request->input('font_family', ''));
        $data['font_family'] = $fontFamily === '' ? null : $fontFamily;

        $data['is_active'] = $request->boolean('is_active', true);

        $template->update($data);

        return redirect()->route('template.index');
    }

    public function preview(Request $request)
    {
        $documentType = $request->input('document_type', 'salary_slip');
        $designOptions = self::DESIGN_OPTIONS[$documentType] ?? [];
        $allowedCodes = implode(',', array_keys($designOptions));

        $data = $request->validate([
            'document_type' => 'required|string|in:' . implode(',', self::MODULES),
            'code' => 'required|string|in:' . $allowedCodes,
            'primary_color' => 'nullable|string|max:20',
            'secondary_color' => 'nullable|string|max:20',
            'accent_color' => 'nullable|string|max:20',
            'font_family' => 'nullable|string|max:100',
            'font_size' => 'nullable|integer|min:6|max:24',
            'line_height' => 'nullable|integer|min:10|max:40',
        ]);

        $fontFamily = trim((string) $request->input('font_family', ''));

        $viewPrefix = $documentType === 'invoice'
            ? 'app.invoice.pdf_templates.'
            : 'app.salary_slip.pdf_templates.';

        $view = $viewPrefix . $data['code'];

        if (! view()->exists($view)) {
            return response('Template view not found: ' . e($view), 404);
        }

        $template = new DocumentTemplate([
            'code' => $data['code'],
            'document_type' => $documentType,
            'name' => 'Preview',
            'primary_color' => $data['primary_color'] ?? null,
            'secondary_color' => $data['secondary_color'] ?? null,
            'accent_color' => $data['accent_color'] ?? null,
            'font_family' => $fontFamily === '' ? null : $fontFamily,
            'font_size' => $data['font_size'] ?? null,
            'line_height' => $data['line_height'] ?? null,
        ]);

        $payload = [
            'template' => $template,
            'is_preview' => true,
        ];

        if ($documentType === 'salary_slip') {
            $previewMeta = [
                'heading' => 'Payslip',
                'company_name' => 'Zoonoodle Inc',
                'company_address' => "21023 Pearson Point Road\nGateway Avenue",
                'payslip_labels' => [
                    'pay_period' => 'Pay Period',
                    'worked_days' => 'Worked Days',
                ],
                'employee_labels' => [
                    'employee_name' => 'Employee Name',
                    'employee_code' => 'Employee ID',
                    'designation' => 'Designation',
                ],
                'pay_period' => 'August 2021',
                'worked_days' => 26,
                'employee_name' => 'Sally Harley',
                'employee_code' => 'EMP-001',
                'designation' => 'Marketing',
                'payslip_extra' => [
                    ['label' => 'Location', 'value' => 'Head Office'],
                ],
                'employee_extra' => [],
                'earnings' => [
                    ['label' => 'Basic', 'amount' => 10000],
                    ['label' => 'Incentive Pay', 'amount' => 1000],
                    ['label' => 'House Rent Allowance', 'amount' => 400],
                    ['label' => 'Meal Allowance', 'amount' => 200],
                ],
                'deductions' => [
                    ['label' => 'Provident Fund', 'amount' => 1200],
                    ['label' => 'Professional Tax', 'amount' => 500],
                    ['label' => 'Loan', 'amount' => 400],
                ],
                'net_pay_in_words' => 'Nine Thousand Five Hundred',
            ];

            $payload['salarySlip'] = new SalarySlip([
                'basic_salary' => 10000,
                'allowance_amount' => 1600,
                'deduction_amount' => 2100,
                'net_salary' => 9500,
                'meta' => $previewMeta,
            ]);
        } else {
            $sampleInvoice = new Invoice([
                'invoice_number' => 'INV-0001',
                'invoice_date' => now(),
                'due_date' => now()->addDays(7),
                'status' => 'draft',
                'subtotal' => 1400,
                'tax_total' => 140,
                'discount_total' => 0,
                'total' => 1540,
                'amount_paid' => 0,
                'currency' => 'USD',
                'notes' => 'Thank you for your business.',
            ]);

            $sampleClient = new Client([
                'name' => 'Acme Corp',
                'company_name' => 'Acme Corp',
                'email' => 'billing@acme.test',
                'address' => "742 Evergreen Terrace\nSpringfield",
            ]);

            $items = collect([
                new InvoiceItem([
                    'description' => 'Consulting Services',
                    'quantity' => 10,
                    'unit_price' => 100,
                    'tax_rate' => 10,
                    'tax_type' => 'percent',
                    'amount' => 1000,
                ]),
                new InvoiceItem([
                    'description' => 'Implementation Support',
                    'quantity' => 4,
                    'unit_price' => 100,
                    'tax_rate' => 10,
                    'tax_type' => 'percent',
                    'amount' => 400,
                ]),
            ]);

            $sampleInvoice->setRelation('client', $sampleClient);
            $sampleInvoice->setRelation('items', $items);

            $payload['invoice'] = $sampleInvoice;
            $payload['business_settings'] = [
                'company_name' => 'Your Business',
                'company_email' => 'hello@business.test',
                'company_address' => "123 Market Street\nMetropolis",
                'currency_symbol' => '$',
            ];
        }

        return response()->view($view, $payload);
    }

    public function destroy(DocumentTemplate $template)
    {
        $template->delete();

        return redirect()->route('template.index');
    }
}
