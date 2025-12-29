<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_templates', function (Blueprint $table) {
            if (!Schema::hasColumn('document_templates', 'show_logo')) {
                $table->boolean('show_logo')->default(true)->after('line_height');
            }
        });
    }

    public function down(): void
    {
        Schema::table('document_templates', function (Blueprint $table) {
            if (Schema::hasColumn('document_templates', 'show_logo')) {
                $table->dropColumn('show_logo');
            }
        });
    }
};
