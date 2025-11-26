<?php

namespace App\MessageHandler;

use App\Message\ExampleMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class ExampleMessageHandler
{
    private LoggerInterface $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    public function __invoke(ExampleMessage $message): void
    {
        $this->logger->info('Processing message', [
            'content' => $message->getContent(),
            'metadata' => $message->getMetadata(),
        ]);
    }
}
