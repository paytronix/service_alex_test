<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Service;

use Psr\Log\LoggerInterface;
use Symfony\Component\Uid\Uuid;

final class CorrelationIdService
{
    private LoggerInterface $logger;
    private ?string $currentCorrelationId = null;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    public function generate(): string
    {
        $correlationId = Uuid::v4()->toRfc4122();
        $this->currentCorrelationId = $correlationId;

        $this->logger->debug('Generated new correlation ID', [
            'correlation_id' => $correlationId,
        ]);

        return $correlationId;
    }

    public function set(string $correlationId): void
    {
        $this->currentCorrelationId = $correlationId;

        $this->logger->debug('Set correlation ID', [
            'correlation_id' => $correlationId,
        ]);
    }

    public function get(): ?string
    {
        return $this->currentCorrelationId;
    }

    public function getOrGenerate(): string
    {
        if ($this->currentCorrelationId === null) {
            return $this->generate();
        }

        return $this->currentCorrelationId;
    }

    public function clear(): void
    {
        $this->currentCorrelationId = null;
    }

    public function extractFromHeaders(array $headers): ?string
    {
        $headerNames = [
            'X-Correlation-ID',
            'X-Request-ID',
            'correlation_id',
            'request_id',
            'correlationId',
            'requestId',
        ];

        foreach ($headerNames as $name) {
            if (isset($headers[$name])) {
                $value = is_array($headers[$name]) ? $headers[$name][0] : $headers[$name];
                if (!empty($value)) {
                    return (string) $value;
                }
            }

            $lowerName = strtolower($name);
            if (isset($headers[$lowerName])) {
                $value = is_array($headers[$lowerName]) ? $headers[$lowerName][0] : $headers[$lowerName];
                if (!empty($value)) {
                    return (string) $value;
                }
            }
        }

        return null;
    }

    public function addToContext(array $context): array
    {
        if ($this->currentCorrelationId !== null) {
            $context['correlation_id'] = $this->currentCorrelationId;
        }

        return $context;
    }
}
