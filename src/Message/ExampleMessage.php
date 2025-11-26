<?php

namespace App\Message;

class ExampleMessage
{
    private string $content;
    private array $metadata;

    public function __construct(string $content, array $metadata = [])
    {
        $this->content = $content;
        $this->metadata = $metadata;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }
}
