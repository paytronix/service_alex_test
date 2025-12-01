<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Service;

use Psr\Cache\CacheItemPoolInterface;
use Psr\Log\LoggerInterface;

final class MessageIdempotencyService
{
    private CacheItemPoolInterface $cache;
    private LoggerInterface $logger;
    private int $ttlSeconds;

    public function __construct(
        CacheItemPoolInterface $cache,
        LoggerInterface $logger,
        int $ttlSeconds = 86400
    ) {
        $this->cache = $cache;
        $this->logger = $logger;
        $this->ttlSeconds = $ttlSeconds;
    }

    public function isProcessed(string $messageId, string $messageType): bool
    {
        $key = $this->generateKey($messageId, $messageType);

        try {
            $item = $this->cache->getItem($key);

            if ($item->isHit()) {
                $this->logger->info('Message already processed (idempotency check)', [
                    'message_id' => $messageId,
                    'message_type' => $messageType,
                    'cache_key' => $key,
                ]);
                return true;
            }

            return false;
        } catch (\Throwable $e) {
            $this->logger->warning('Idempotency check failed, allowing processing', [
                'message_id' => $messageId,
                'message_type' => $messageType,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    public function markAsProcessed(string $messageId, string $messageType): void
    {
        $key = $this->generateKey($messageId, $messageType);

        try {
            $item = $this->cache->getItem($key);
            $item->set([
                'message_id' => $messageId,
                'message_type' => $messageType,
                'processed_at' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
            ]);
            $item->expiresAfter($this->ttlSeconds);
            $this->cache->save($item);

            $this->logger->debug('Message marked as processed', [
                'message_id' => $messageId,
                'message_type' => $messageType,
                'cache_key' => $key,
                'ttl_seconds' => $this->ttlSeconds,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to mark message as processed', [
                'message_id' => $messageId,
                'message_type' => $messageType,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function removeProcessedMark(string $messageId, string $messageType): void
    {
        $key = $this->generateKey($messageId, $messageType);

        try {
            $this->cache->deleteItem($key);

            $this->logger->debug('Message processing mark removed', [
                'message_id' => $messageId,
                'message_type' => $messageType,
                'cache_key' => $key,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to remove message processing mark', [
                'message_id' => $messageId,
                'message_type' => $messageType,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function generateMessageId(string $aggregateId, string $eventType, string $occurredOn): string
    {
        return hash('sha256', sprintf('%s:%s:%s', $aggregateId, $eventType, $occurredOn));
    }

    private function generateKey(string $messageId, string $messageType): string
    {
        return sprintf('msg_idempotency_%s_%s', $messageType, $messageId);
    }
}
