<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Client;
use App\Models\Tax;
use App\Models\DocumentTemplate;
use App\Services\InvoiceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\UserSetting;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    protected $invoiceService;

    public function __construct(InvoiceService $invoiceService)
    {
        $this->invoiceService = $invoiceService;
    }

    public function index()
    {
        $allowedPerPage = [5, 10, 15, 20, 25];
        $perPage = (int) request()->query('per_page', 10);
        if (! in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $invoices = Auth::user()->invoices()
            ->with('client')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage)
            ->appends(request()->query());

        return Inertia::render('Invoices/Index', [
            'invoices' => $invoices
        ]);
    }

    public function create()
    {
        $clients = Auth::user()->clients()->orderBy('name')->get();
        // Generate a potential invoice number (not saved yet, just for display)
        $nextNumber = $this->invoiceService->generateInvoiceNumber(Auth::user());

        $settings = UserSetting::getMapForUser(Auth::id());
        $taxes = Tax::where('user_id', Auth::id())->active()->orderBy('name')->get();
        $templates = DocumentTemplate::where('user_id', Auth::id())
            ->where('document_type', 'invoice')
            ->orderBy('name')
            ->get();

        return Inertia::render('Invoices/Create', [
            'clients' => $clients,
            'nextNumber' => $nextNumber,
            'today' => now()->format('Y-m-d'),
            'business_settings' => $settings,
            'taxes' => $taxes,
            'templates' => $templates,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id', // Ensure auth user owns client? validation rule might need closure to check ownership
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'invoice_number' => [
                'nullable',
                'string',
                Rule::unique('invoices', 'invoice_number')->where(fn ($q) => $q->where('user_id', Auth::id())),
            ],
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.tax_rate' => 'nullable|numeric|min:0',
            'items.*.tax_type' => 'nullable|in:percent,fixed',
            'items.*.tax_id' => 'nullable|exists:taxes,id',
            'invoice_template_id' => 'required|exists:document_templates,id',
            'notes' => 'nullable|string',
        ]);

        // Verify client ownership
        $client = Auth::user()->clients()->find($validated['client_id']);
        if (!$client) {
            return back()->withErrors(['client_id' => 'Invalid client selected.']);
        }

        DB::transaction(function () use ($validated) {
            $invoice = Auth::user()->invoices()->create([
                'client_id' => $validated['client_id'],
                'invoice_number' => trim($validated['invoice_number'] ?? '') !== ''
                    ? trim($validated['invoice_number'])
                    : $this->invoiceService->generateInvoiceNumber(Auth::user()),
                'invoice_date' => $validated['invoice_date'],
                'due_date' => $validated['due_date'],
                'invoice_template_id' => $validated['invoice_template_id'] ?? null,
                'notes' => $validated['notes'],
                'status' => 'draft',
            ]);

            foreach ($validated['items'] as $itemData) {
                $amount = $itemData['quantity'] * $itemData['unit_price'];
                $invoice->items()->create([
                    'description' => $itemData['description'],
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['unit_price'],
                    'tax_rate' => $itemData['tax_rate'] ?? 0,
                    'tax_type' => $itemData['tax_type'] ?? 'percent',
                    'tax_id' => $itemData['tax_id'] ?? null,
                    'amount' => $amount,
                ]);
            }

            $this->invoiceService->calculateTotals($invoice);
        });

        return redirect()->route('invoices.index')->with('success', 'Invoice created successfully.');
    }

    public function edit(Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        $invoice->load(['client', 'items']);
        $clients = Auth::user()->clients()->orderBy('name')->get();

        $selectedTaxIds = $invoice->items->pluck('tax_id')->filter()->unique();
        $taxes = Tax::where('user_id', Auth::id())
            ->where(function ($query) use ($selectedTaxIds) {
                $query->active();

                if ($selectedTaxIds->isNotEmpty()) {
                    $query->orWhereIn('id', $selectedTaxIds);
                }
            })
            ->orderBy('name')
            ->get();
        $templates = DocumentTemplate::where('user_id', Auth::id())
            ->where('document_type', 'invoice')
            ->orderBy('name')
            ->get();

        return Inertia::render('Invoices/Edit', [
            'invoice' => $invoice,
            'clients' => $clients,
            'taxes' => $taxes,
            'templates' => $templates,
        ]);
    }

    public function update(Request $request, Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'invoice_number' => [
                'nullable',
                'string',
                Rule::unique('invoices', 'invoice_number')
                    ->ignore($invoice->id)
                    ->where(fn ($q) => $q->where('user_id', Auth::id())),
            ],
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.tax_rate' => 'nullable|numeric|min:0',
            'items.*.tax_type' => 'nullable|in:percent,fixed',
            'items.*.tax_id' => 'nullable|exists:taxes,id',
            'invoice_template_id' => 'required|exists:document_templates,id',
            'notes' => 'nullable|string',
            'status' => 'required|in:draft,sent,paid,partially_paid,overdue,cancelled'
        ]);

        // Verify client ownership
        $client = Auth::user()->clients()->find($validated['client_id']);
        if (!$client) {
            return back()->withErrors(['client_id' => 'Invalid client selected.']);
        }

        DB::transaction(function () use ($validated, $invoice) {
            $invoice->update([
                'client_id' => $validated['client_id'],
                'invoice_number' => trim($validated['invoice_number'] ?? '') !== ''
                    ? trim($validated['invoice_number'])
                    : ($invoice->invoice_number ?: $this->invoiceService->generateInvoiceNumber(Auth::user())),
                'invoice_date' => $validated['invoice_date'],
                'due_date' => $validated['due_date'],
                'invoice_template_id' => $validated['invoice_template_id'] ?? null,
                'notes' => $validated['notes'],
                'status' => $validated['status'],
            ]);

            // Replace items
            $invoice->items()->delete();

            foreach ($validated['items'] as $itemData) {
                $amount = $itemData['quantity'] * $itemData['unit_price'];
                $invoice->items()->create([
                    'description' => $itemData['description'],
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['unit_price'],
                    'tax_rate' => $itemData['tax_rate'] ?? 0,
                    'tax_type' => $itemData['tax_type'] ?? 'percent',
                    'tax_id' => $itemData['tax_id'] ?? null,
                    'amount' => $amount,
                ]);
            }

            $this->invoiceService->calculateTotals($invoice);
        });

        return redirect()->route('invoices.index')->with('success', 'Invoice updated successfully.');
    }

    public function show(Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        $invoice->load(['client', 'items']);
        $user = Auth::user();
        $settings = UserSetting::getMapForUser(Auth::id());

        $template = null;
        if ($invoice->invoice_template_id) {
            $template = DocumentTemplate::where('id', $invoice->invoice_template_id)->first();
        }

        if (! $template) {
            $template = DocumentTemplate::where('user_id', Auth::id())
                ->where('document_type', 'invoice')
                ->orderBy('name')
                ->first();
        }

        $templateCode = $template->code ?? 'business';
        $view = 'app.invoice.pdf_templates.' . $templateCode;
        if (! view()->exists($view)) {
            $view = 'app.invoice.pdf_templates.business';
        }

        $renderedTemplate = view($view, [
            'invoice' => $invoice,
            'template' => $template,
            'business_settings' => $settings,
        ])->render();

        return Inertia::render('Invoices/Show', [
            'invoice' => $invoice,
            'business' => [
                'name' => $user->name, // Or a business name setting
                'email' => $user->email,
                // Add more from settings if available
            ],
            'settingsDefaults' => $settings,
            'business_settings' => $settings,
            'renderedTemplate' => $renderedTemplate,
        ]);
    }

    public function destroy(Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        $invoice->delete();

        return redirect()->route('invoices.index')->with('success', 'Invoice deleted successfully.');
    }

    public function print(Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        $invoice->load(['client', 'items']);
        $settings = UserSetting::getMapForUser(Auth::id());

        // Merge invoice specific snapshots with defaults if missing
        // But InvoicePaper handles this precedence if we pass the invoice object correctly

        return Inertia::render('Invoices/Print', [
            'invoice' => $invoice,
            'business_settings' => $settings,
        ]);
    }

    public function duplicate(Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        $invoice->load('items');

        DB::transaction(function () use ($invoice) {
            $newInvoice = $invoice->replicate(['invoice_number', 'status', 'created_at', 'updated_at']);
            $newInvoice->invoice_number = $this->invoiceService->generateInvoiceNumber(Auth::user());
            $newInvoice->status = 'draft';
            $newInvoice->invoice_date = now()->format('Y-m-d');
            $newInvoice->due_date = null; // or calculate based on terms
            $newInvoice->save();

            foreach ($invoice->items as $item) {
                $newInvoice->items()->create($item->replicate(['invoice_id', 'created_at', 'updated_at'])->toArray());
            }

            $this->invoiceService->calculateTotals($newInvoice);
        });

        return redirect()->route('invoices.index')->with('success', 'Invoice duplicated successfully.');
    }

    public function send(Invoice $invoice)
    {
        if ($invoice->user_id !== Auth::id()) {
            abort(403);
        }

        // Placeholder for email logic
        // Mail::to($invoice->client->email)->send(new InvoiceCreated($invoice));

        $invoice->update(['status' => 'sent']);

        return back()->with('success', 'Invoice sent successfully (Simulation).');
    }
}
