<?php

namespace Wexample\SymfonyDataSyncDs\Security;

use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * Grants the sync screens to whoever holds the configured role, so each app
 * decides who may review and apply plans while the controllers name a single
 * attribute.
 */
final class DataSyncAccessVoter extends Voter
{
    public const string ATTRIBUTE = 'DATA_SYNC_ACCESS';

    public function __construct(
        private readonly Security $security,
        #[Autowire('%wexample_symfony_data_sync_ds.access_role%')]
        private readonly string $accessRole,
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return self::ATTRIBUTE === $attribute;
    }

    protected function voteOnAttribute(
        string $attribute,
        mixed $subject,
        TokenInterface $token,
        ?Vote $vote = null
    ): bool {
        return $this->security->isGranted($this->accessRole);
    }
}
