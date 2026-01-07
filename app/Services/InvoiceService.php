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
        $totalTax = 0;
        $totalDiscount = 0;

        // 1. Calculate Base Subtotal
        foreach ($invoice->items as $item) {
            $subtotal += $item->quantity * $item->unit_price;
        }

        // 2. Determine Discount Mode & Amounts
        $discountMode = $invoice->discount_mode ?? 'none';
        $invoiceDiscountAmount = 0;

        if ($discountMode === 'invoice') {
            $dValue = $invoice->discount_value ?? 0;
            $dType = $invoice->discount_type ?? 'fixed';
            
            if ($dType === 'percent') {
                $invoiceDiscountAmount = $subtotal * ($dValue / 100);
            } else {
                $invoiceDiscountAmount = $dValue;
            }
            // Cap discount at subtotal
            if ($invoiceDiscountAmount > $subtotal) {
                $invoiceDiscountAmount = $subtotal;
            }
            $totalDiscount = $invoiceDiscountAmount;
        }

        // 3. Process Items for Tax and Item-Level Discounts
        foreach ($invoice->items as $item) {
            $baseAmount = $item->quantity * $item->unit_price;
            $itemDiscount = 0;
            
            // Calculate Discount
            if ($discountMode === 'item') {
                $dValue = $item->discount_value ?? 0;
                $dType = $item->discount_type ?? 'fixed'; // InvoiceItem has discount_type
                
                if ($dType === 'percent') {
                    $itemDiscount = $baseAmount * ($dValue / 100);
                } else {
                    $itemDiscount = $dValue;
                }
                
                // Cap
                if ($itemDiscount > $baseAmount) {
                    $itemDiscount = $baseAmount;
                }
                
                // Update item's stored calculated discount
                $item->discount_amount = $itemDiscount;
                $item->saveQuietly(); // Avoid triggering events if possible, or just save
                
                $totalDiscount += $itemDiscount;
            } elseif ($discountMode === 'invoice') {
                 // Pro-rate invoice discount for tax calculation
                 // share = (base / subtotal) * invoiceDiscount
                 // Avoid div by zero
                 if ($subtotal > 0) {
                     $itemDiscount = ($baseAmount / $subtotal) * $invoiceDiscountAmount;
                 }
                 // We don't save per-item share in DB for invoice-level mode, usually?
                 // Or we could. For now let's just use it for tax basis.
                 $item->discount_amount = 0; // Clear item level specific discount
                 $item->saveQuietly();
            } else {
                $item->discount_amount = 0;
                $item->saveQuietly();
            }
            
            $taxableAmount = $baseAmount - $itemDiscount;
            
            // Calculate Tax
            $itemTax = 0;
            if ($item->tax_rate > 0) {
                if ($item->tax_type === 'fixed') {
                    // Fixed tax usually per qty? Or flat per line?
                    // Assuming per quantity based on previous code: $item->quantity * $item->tax_rate;
                    // BUT: fixed tax might not be affected by discount. 
                    // If it's "Fixed amount per unit", distinct from price. 
                    $itemTax = $item->quantity * $item->tax_rate;
                } else {
                    $itemTax = $taxableAmount * ($item->tax_rate / 100);
                }
            }
            
            $totalTax += $itemTax;
        }

        $total = $subtotal - $totalDiscount + $totalTax;

        $invoice->update([
            'subtotal' => $subtotal,
            'tax_total' => $totalTax,
            'discount_total' => $totalDiscount, // We can use this or discount_amount
            'discount_amount' => ($discountMode === 'invoice' ? $totalDiscount : 0), // Store specific invoice-level discount
            'total' => $total,
        ]);

        return $invoice;
    }
}
