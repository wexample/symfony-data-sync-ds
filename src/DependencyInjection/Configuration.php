<?php

namespace Wexample\SymfonyDataSyncDs\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;
use Wexample\SymfonyHelpers\Helper\RoleHelper;

class Configuration implements ConfigurationInterface
{
    public function getConfigTreeBuilder(): TreeBuilder
    {
        $treeBuilder = new TreeBuilder('wexample_symfony_data_sync_ds');

        $treeBuilder->getRootNode()
            ->children()
                ->scalarNode('access_role')
                    ->defaultValue(RoleHelper::ROLE_ADMIN)
                    ->info('Role required to review plans and apply them, which writes on both sides.')
                ->end()
            ->end();

        return $treeBuilder;
    }
}
