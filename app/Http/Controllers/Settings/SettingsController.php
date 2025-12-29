<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $user->loadMissing('roles');

        $settings = UserSetting::getMapForUser($user->id);

        $brandingKeys = ['logo_dark', 'logo_light', 'favicon', 'invoice_logo'];
        $userBranding = array_intersect_key($settings, array_flip($brandingKeys));

        $adminId = null;
        if ($user->roles && $user->roles->contains('slug', 'admin')) {
            $adminId = $user->id;
        } else {
            $adminId = User::query()
                ->whereHas('roles', function ($query) {
                    $query->where('slug', 'admin');
                })
                ->orderBy('id')
                ->value('id');
        }

        $adminBranding = $adminId
            ? UserSetting::getKeysForUser((int) $adminId, $brandingKeys)
            : [];

        $logoDarkPath = $userBranding['logo_dark'] ?? $adminBranding['logo_dark'] ?? null;
        $logoLightPath = $userBranding['logo_light'] ?? $adminBranding['logo_light'] ?? null;
        $faviconPath = $userBranding['favicon'] ?? $adminBranding['favicon'] ?? null;
        $invoiceLogoPath = $userBranding['invoice_logo'] ?? $adminBranding['invoice_logo'] ?? null;

        return Inertia::render('settings/index', [
            'settings' => $settings,
            'brand' => [
                'logo_dark_url' => $logoDarkPath ? asset('storage/'.$logoDarkPath) : null,
                'logo_light_url' => $logoLightPath ? asset('storage/'.$logoLightPath) : null,
                'favicon_url' => $faviconPath ? asset('storage/'.$faviconPath) : null,
                'invoice_logo_url' => $invoiceLogoPath ? asset('storage/'.$invoiceLogoPath) : null,
            ],
            'currencies' => config('currencies.options'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $existing = UserSetting::getMapForUser($user->id);

        $validatedFiles = $request->validate([
            'invoice_logo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,svg,webp', 'max:4096'],
        ]);

        $incoming = $request->input('settings');
        if (!is_array($incoming)) {
            $incoming = $request->except(['_token']);
        }

        $settings = [];
        foreach ($incoming as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }

            if (!preg_match('/^[a-z0-9_.-]+$/i', $key)) {
                continue;
            }

            if (is_array($value) || is_object($value)) {
                continue;
            }

            $value = $value === null ? null : (string) $value;
            if ($value !== null && mb_strlen($value) > 10000) {
                continue;
            }

            $settings[$key] = $value;
        }

        $deletes = [];
        if ($request->hasFile('invoice_logo')) {
            $file = $validatedFiles['invoice_logo'];
            $path = $this->storeBrandFile($user->id, 'invoice_logo', $file);
            $settings['invoice_logo'] = $path;
            $old = $existing['invoice_logo'] ?? null;
            if ($old && $old !== $path) {
                $deletes[] = $old;
            }
        }

        UserSetting::upsertForUser($user->id, $settings);

        Cache::forget("user_settings:{$user->id}:branding");
        Cache::forget("user_settings:{$user->id}:salary_slip_defaults");

        foreach ($deletes as $oldPath) {
            if (Storage::disk('public')->exists($oldPath)) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        return back();
    }

    public function updateBrand(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'logo_dark' => ['nullable', 'file', 'mimes:jpg,jpeg,png,svg,webp', 'max:4096'],
            'logo_light' => ['nullable', 'file', 'mimes:jpg,jpeg,png,svg,webp', 'max:4096'],
            'favicon' => ['nullable', 'file', 'mimes:jpg,jpeg,png,svg,webp', 'max:4096'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'company_address' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();

        $existing = UserSetting::getMapForUser($user->id);
        $updates = [];
        $deletes = [];

        foreach (['logo_dark', 'logo_light', 'favicon'] as $key) {
            $file = $validated[$key] ?? null;
            if (!$file) {
                continue;
            }

            $oldPath = $existing[$key] ?? null;
            $path = $this->storeBrandFile($user->id, $key, $file);
            $updates[$key] = $path;

            if ($key === 'favicon') {
                $updates['favicon_v'] = (string) ((int) round(microtime(true) * 1000));
            }

            if ($oldPath && $oldPath !== $path) {
                $deletes[] = $oldPath;
            }
        }

        if (array_key_exists('company_name', $validated)) {
            $updates['company_name'] = $validated['company_name'];
        }

        if (array_key_exists('company_address', $validated)) {
            $updates['company_address'] = $validated['company_address'];
        }

        if (count($updates) > 0) {
            UserSetting::upsertForUser($user->id, $updates);
        }

        Cache::forget("user_settings:{$user->id}:branding");
        Cache::forget("user_settings:{$user->id}:salary_slip_defaults");

        foreach ($deletes as $oldPath) {
            if (Storage::disk('public')->exists($oldPath)) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        return back();
    }

    protected function storeBrandFile(int $userId, string $key, mixed $file): string
    {
        $directory = "brand/{$userId}";

        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'png');
        $ext = $ext === 'jpeg' ? 'jpg' : $ext;

        $filename = match ($key) {
            'logo_dark' => "logo-dark.{$ext}",
            'logo_light' => "logo-light.{$ext}",
            'favicon' => "favicon.{$ext}",
            default => "{$key}.{$ext}",
        };

        return $file->storeAs($directory, $filename, 'public');
    }
}
