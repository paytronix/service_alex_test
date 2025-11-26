<?php

namespace App\Tests\Message;

use App\Message\ExampleMessage;
use PHPUnit\Framework\TestCase;

class ExampleMessageTest extends TestCase
{
    public function testMessageCreation(): void
    {
        $content = 'Test message content';
        $metadata = ['key' => 'value', 'priority' => 'high'];

        $message = new ExampleMessage($content, $metadata);

        $this->assertEquals($content, $message->getContent());
        $this->assertEquals($metadata, $message->getMetadata());
    }

    public function testMessageWithEmptyMetadata(): void
    {
        $content = 'Test message content';

        $message = new ExampleMessage($content);

        $this->assertEquals($content, $message->getContent());
        $this->assertEquals([], $message->getMetadata());
    }
}
