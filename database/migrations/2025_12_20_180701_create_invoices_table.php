<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // Seller
            // Buyer (nullable so ON DELETE SET NULL works)
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('invoice_template_id')
                ->nullable()
                ->constrained('document_templates')
                ->nullOnDelete();
            
            $table->string('invoice_number');
            $table->date('invoice_date');
            $table->date('due_date')->nullable();
            
            $table->enum('status', ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'])->default('draft');
            
            // Financials
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_total', 15, 2)->default(0);
            $table->decimal('discount_total', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->string('notes', 2000)->nullable();
            $table->text('terms')->nullable();
            
            $table->timestamps();

            $table->unique(['invoice_number']); // Unique invoice number per user
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
