<?php

namespace Wexample\SymfonyDataSyncDs\Controller\Pages;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Wexample\SymfonyDataSync\Class\SyncDefinition;
use Wexample\SymfonyDataSync\Service\SyncDefinitionRegistry;
use Wexample\SymfonyDataSyncDs\Security\DataSyncAccessVoter;
use Wexample\SymfonyDataSyncDs\Traits\SymfonyDataSyncDsBundleClassTrait;
use Wexample\SymfonyLoader\Controller\AbstractPagesController;

/**
 * The sync definitions, and one page per definition to review its plan. A
 * plan lists the remote, so the page renders at once and loads it afterwards.
 */
#[Route(path: '/data-sync/', name: 'data_sync_')]
#[IsGranted(DataSyncAccessVoter::ATTRIBUTE)]
final class DataSyncController extends AbstractPagesController
{
    use SymfonyDataSyncDsBundleClassTrait;

    public const string ROUTE_INDEX = 'data_sync_index';

    public const string ROUTE_DEFINITION = 'data_sync_definition';

    #[Route(path: '', name: 'index')]
    public function index(SyncDefinitionRegistry $registry): Response
    {
        return $this->renderPage('index', [
            'definitions' => array_map(static fn (SyncDefinition $definition): array => [
                'localClass' => $definition->localClass,
                'adapterClass' => $definition->adapter::class,
            ], $registry->all()),
        ]);
    }

    #[Route(path: '{key}', name: 'definition')]
    public function definition(string $key, SyncDefinitionRegistry $registry): Response
    {
        if (! in_array($key, $registry->getKeys(), true)) {
            throw new NotFoundHttpException(sprintf('No sync definition "%s".', $key));
        }

        $definition = $registry->get($key);

        return $this->renderPage('definition', [
            'definition' => $definition,
            'adapter_class' => $definition->adapter::class,
        ]);
    }
}
