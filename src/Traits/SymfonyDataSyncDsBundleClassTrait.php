<?php

namespace Wexample\SymfonyDataSyncDs\Traits;

use Wexample\SymfonyDataSyncDs\WexampleSymfonyDataSyncDsBundle;
use Wexample\SymfonyHelpers\Traits\BundleClassTrait;

trait SymfonyDataSyncDsBundleClassTrait
{
    use BundleClassTrait;

    public static function getBundleClassName(): string
    {
        return WexampleSymfonyDataSyncDsBundle::class;
    }
}
