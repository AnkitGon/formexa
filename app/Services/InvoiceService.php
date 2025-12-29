<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Support\Str;

class InvoiceService
{
    public function generateInvoiceNumber(User $user): string
    {
        // Get prefix/series from settings or defaults
        $settings = $user->settings()
            ->whereIn('key', ['invoice_prefix', 'invoice_series'])
            ->pluck('value', 'key');

        $prefix = $settings->get('invoice_prefix', 'INV-');
        $series = $settings->get('invoice_series', now()->format('Y'));

        // Build the search base e.g., INV-2025-
        $base = $prefix . $series . '-';

        // Find the last invoice number for this user
        $lastInvoice = Invoice::where('user_id', $user->id)
            ->where('invoice_number', 'LIKE', "{$base}%")
            ->orderBy('id', 'desc')
            ->first();

        if (! $lastInvoice) {
            return $base . '0001';
        }

        // Extract the number part
        // Assuming format is PREFIXSERIES-NUMBER (e.g., INV-2025-0001)
        $lastNumberStr = Str::after($lastInvoice->invoice_number, $base);

        // Try to parse it as integer
        $lastNumber = intval($lastNumberStr);

        // Increment and pad
        $nextNumber = $lastNumber + 1;
        return $base . str_pad((string)$nextNumber, 4, '0', STR_PAD_LEFT);
    }

    public function calculateTotals(Invoice $invoice)
    {
        $subtotal = 0;
        $taxTotal = 0;
        $discountTotal = 0; // Keeping it 0 for now as item level discount logic is not fully defined

        foreach ($invoice->items as $item) {
            // Amount is already calculated in item model or controller, but let's re-verify
            // item amount = qty * unit_price
            $itemAmount = $item->quantity * $item->unit_price;

            // Tax
            $itemTax = 0;
            if ($item->tax_rate > 0) {
                if ($item->tax_type === 'fixed') {
                    // Fixed tax per item quantity or just once per line? 
                    // Usually fixed tax is per unit, so qty * tax_rate
                    $itemTax = $item->quantity * $item->tax_rate;
                } else {
                    $itemTax = $itemAmount * ($item->tax_rate / 100);
                }
            }

            $subtotal += $itemAmount;
            $taxTotal += $itemTax;
        }

        $total = $subtotal + $taxTotal - $discountTotal;

        $invoice->update([
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            // 'discount_total' => $discountTotal,
            'total' => $total,
        ]);

        return $invoice;
    }
}
