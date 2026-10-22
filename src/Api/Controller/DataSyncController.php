<?php

namespace Wexample\SymfonyDataSyncDs\Api\Controller;

use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Wexample\SymfonyApi\Api\Class\ApiResponse;
use Wexample\SymfonyApi\Api\Controller\AbstractApiController;
use Wexample\SymfonyDataSync\Enum\SyncSide;
use Wexample\SymfonyDataSync\Service\SyncDefinitionRegistry;
use Wexample\SymfonyDataSync\Service\SyncLinker;
use Wexample\SymfonyDataSync\Service\SyncResolver;
use Wexample\SymfonyDataSync\Service\SyncRunner;
use Wexample\SymfonyDataSyncDs\Security\DataSyncAccessVoter;
use Wexample\SymfonyHelpers\Controller\AbstractController;

/**
 * What the definition screen calls: its plan as a dry run, the same plan run
 * for real, a manual link and a conflict settled by hand. Plans and runs
 * answer SyncReport::toArray().
 */
#[Route(path: 'api/data-sync/', name: 'api_data_sync_')]
#[IsGranted(DataSyncAccessVoter::ATTRIBUTE)]
class DataSyncController extends AbstractApiController
{
    final public const string ROUTE_LINK = 'api_data_sync_link';

    final public const string ROUTE_PLAN = 'api_data_sync_plan';

    final public const string ROUTE_RESOLVE = 'api_data_sync_resolve';

    final public const string ROUTE_RUN = 'api_data_sync_run';

    public function __construct(
        private readonly SyncDefinitionRegistry $registry,
        private readonly SyncRunner $runner,
        private readonly SyncLinker $linker,
        private readonly SyncResolver $resolver,
    ) {
    }

    #[Route(path: 'plan/{key}', name: 'plan', methods: AbstractController::ROUTE_OPTIONS_METHOD_ONLY_GET, options: AbstractController::ROUTE_OPTIONS_ONLY_EXPOSE)]
    public function plan(string $key): ApiResponse
    {
        return $this->report($key, true);
    }

    #[Route(path: 'run/{key}', name: 'run', methods: AbstractController::ROUTE_OPTIONS_METHOD_ONLY_POST, options: AbstractController::ROUTE_OPTIONS_ONLY_EXPOSE)]
    public function run(string $key): ApiResponse
    {
        return $this->report($key, false);
    }

    /**
     * Body: {"localId": "…", "remoteId": "…"}.
     */
    #[Route(path: 'link/{key}', name: 'link', methods: AbstractController::ROUTE_OPTIONS_METHOD_ONLY_POST, options: AbstractController::ROUTE_OPTIONS_ONLY_EXPOSE)]
    public function link(string $key, Request $request): ApiResponse
    {
        if (! $this->exists($key)) {
            return self::apiResponseError('Unknown sync definition.');
        }

        $body = $request->toArray();

        try {
            $this->linker->link($key, (string) ($body['localId'] ?? ''), (string) ($body['remoteId'] ?? ''));
        } catch (InvalidArgumentException $exception) {
            return self::apiResponseError($exception->getMessage());
        }

        return self::apiResponseSuccess('Linked.');
    }

    /**
     * Body: {"localId": "…", "kept": "local"|"remote"}; the kept side's values
     * are written on the other one.
     */
    #[Route(path: 'resolve/{key}', name: 'resolve', methods: AbstractController::ROUTE_OPTIONS_METHOD_ONLY_POST, options: AbstractController::ROUTE_OPTIONS_ONLY_EXPOSE)]
    public function resolve(string $key, Request $request): ApiResponse
    {
        if (! $this->exists($key)) {
            return self::apiResponseError('Unknown sync definition.');
        }

        $body = $request->toArray();
        $kept = SyncSide::tryFrom((string) ($body['kept'] ?? ''));

        if (null === $kept || SyncSide::None === $kept) {
            return self::apiResponseError('The kept side must be "local" or "remote".');
        }

        try {
            $this->resolver->resolve($key, (string) ($body['localId'] ?? ''), $kept);
        } catch (InvalidArgumentException $exception) {
            return self::apiResponseError($exception->getMessage());
        }

        return self::apiResponseSuccess('Resolved.');
    }

    private function report(string $key, bool $dryRun): ApiResponse
    {
        if (! $this->exists($key)) {
            return self::apiResponseError('Unknown sync definition.');
        }

        return self::apiResponseSuccess(data: $this->runner->run($key, $dryRun)->toArray());
    }

    private function exists(string $key): bool
    {
        return in_array($key, $this->registry->getKeys(), true);
    }
}
