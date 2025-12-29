<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'code',
        'document_type',
        'description',
        'preview_image_path',
        'is_active',
        'primary_color',
        'secondary_color',
        'accent_color',
        'font_family',
        'font_size',
        'line_height',
        'show_logo',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'font_size' => 'integer',
        'line_height' => 'integer',
        'show_logo' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function getPreviewImageUrlAttribute(): ?string
    {
        if (! $this->preview_image_path) {
            return null;
        }

        return asset('storage/' . ltrim($this->preview_image_path, '/'));
    }
}
