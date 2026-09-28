<?php

namespace Wexample\SymfonyDataSyncDs\Tests\Unit\Api\Controller;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Config\Definition\Processor;
use Symfony\Component\DependencyInjection\ServiceLocator;
use Symfony\Component\HttpFoundation\Request;
use Wexample\SymfonyApi\Api\Class\ApiResponse;
use Wexample\SymfonyDataSync\DependencyInjection\Configuration;
use Wexample\SymfonyDataSync\Service\DoctrineLinkStore;
use Wexample\SymfonyDataSync\Service\Matcher;
use Wexample\SymfonyDataSync\Service\SyncDefinitionRegistry;
use Wexample\SymfonyDataSync\Service\SyncExecutor;
use Wexample\SymfonyDataSync\Service\SyncLinker;
use Wexample\SymfonyDataSync\Service\SyncPlanner;
use Wexample\SymfonyDataSync\Service\SyncResolver;
use Wexample\SymfonyDataSync\Service\SyncRunner;
use Wexample\SymfonyDataSync\Testing\InMemoryLocalStore;
use Wexample\SymfonyDataSync\Testing\InMemoryRemoteAdapter;
use Wexample\SymfonyDataSyncDs\Api\Controller\DataSyncController;

class DataSyncControllerTest extends TestCase
{
    private InMemoryRemoteAdapter $remote;

    private InMemoryLocalStore $locals;

    private DataSyncController $controller;

    protected function setUp(): void
    {
        $this->remote = new InMemoryRemoteAdapter([
            'r1' => ['username' => 'ada', 'email' => 'ADA@example.test'],
            'r2' => ['username' => 'cid', 'email' => 'cid@example.test'],
        ]);
        $this->locals = new InMemoryLocalStore([
            'u1' => ['username' => 'ada', 'email' => 'ada@example.test', 'remoteId' => null],
            'u2' => ['username' => 'bob', 'email' => 'bob@example.test', 'remoteId' => null],
        ]);

        $config = (new Processor())->processConfiguration(new Configuration(), [[
            'definitions' => [
                'users' => [
                    'local' => 'stdClass',
                    'adapter' => 'remote',
                    'local_store' => 'locals',
                    'link_property' => 'remoteId',
                    'match' => [['local' => 'email', 'remote' => 'email', 'normalize' => ['email']]],
                    'fields' => ['username' => 'username', 'email' => ['remote' => 'email', 'direction' => 'both']],
                    'orphans' => ['local' => 'create_remote'],
                ],
            ],
        ]]);
        $registry = new SyncDefinitionRegistry(
            $this->createStub(DoctrineLinkStore::class),
            $config['definitions'],
            new ServiceLocator(['remote' => fn () => $this->remote, 'locals' => fn () => $this->locals]),
        );

        $planner = new SyncPlanner(new Matcher());
        $this->controller = new DataSyncController(
            $registry,
            new SyncRunner($registry, $planner, new SyncExecutor()),
            new SyncLinker($registry),
            new SyncResolver($registry, $planner, new SyncExecutor()),
        );
    }

    public function testThePlanIsADryRun(): void
    {
        $envelope = $this->envelope($this->controller->plan('users'));

        $this->assertSame('success', $envelope['type']);
        $this->assertTrue($envelope['data']['dryRun']);
        $this->assertSame(['local_link', 'remote_create', 'unmatched'], array_column($envelope['data']['relations'], 'operation'));
        $this->assertSame([], $this->remote->calls);
    }

    public function testRunningWritesThePlan(): void
    {
        $envelope = $this->envelope($this->controller->run('users'));

        $this->assertFalse($envelope['data']['dryRun']);
        $this->assertSame('r1', $this->locals->entities['u1']->remoteId);
        $this->assertSame([['create', 'remote-1']], $this->remote->calls);
    }

    public function testAPairIsLinkedByHand(): void
    {
        $envelope = $this->envelope($this->controller->link('users', $this->json(['localId' => 'u2', 'remoteId' => 'r2'])));

        $this->assertSame('success', $envelope['type']);
        $this->assertSame('r2', $this->locals->entities['u2']->remoteId);
    }

    public function testAnImpossibleLinkSaysWhy(): void
    {
        $envelope = $this->envelope($this->controller->link('users', $this->json(['localId' => 'u2', 'remoteId' => 'nope'])));

        $this->assertSame('error', $envelope['type']);
        $this->assertSame('No remote item "nope".', $envelope['message']);
    }

    public function testAConflictIsResolvedByTheKeptSide(): void
    {
        $this->controller->run('users');
        $envelope = $this->envelope($this->controller->resolve('users', $this->json(['localId' => 'u1', 'kept' => 'remote'])));

        $this->assertSame('success', $envelope['type']);
        $this->assertSame('ADA@example.test', $this->locals->entities['u1']->email);
    }

    public function testResolvingNeedsAKeptSide(): void
    {
        $this->controller->run('users');
        $envelope = $this->envelope($this->controller->resolve('users', $this->json(['localId' => 'u1', 'kept' => 'none'])));

        $this->assertSame('error', $envelope['type']);
        $this->assertSame('ada@example.test', $this->locals->entities['u1']->email);
    }

    public function testAnUnknownDefinitionIsAnError(): void
    {
        $this->assertSame('error', $this->envelope($this->controller->plan('missing'))['type']);
    }

    private function json(array $body): Request
    {
        return new Request(content: json_encode($body));
    }

    private function envelope(ApiResponse $response): array
    {
        return json_decode((string) $response->toJsonResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
    }
}
