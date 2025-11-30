<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Service;

use App\Application\Exception\OrderValidationException;
use App\Application\Service\MenuServiceClientInterface;
use App\Application\Service\OrderValidationService;
use App\Domain\ValueObject\OrderStatus;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

final class OrderValidationServiceTest extends TestCase
{
    private MenuServiceClientInterface&MockObject $menuServiceClient;
    private OrderValidationService $service;

    protected function setUp(): void
    {
        $this->menuServiceClient = $this->createMock(MenuServiceClientInterface::class);
        $this->service = new OrderValidationService($this->menuServiceClient);
    }

    public function testValidateCreateWithValidPayload(): void
    {
        $payload = [
            'customer_email' => 'test@example.com',
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
            'items' => [
                ['product_id' => 'prod-1'],
                ['product_id' => 'prod-2'],
            ],
        ];

        $this->menuServiceClient
            ->expects($this->once())
            ->method('areItemsAvailable')
            ->with(['prod-1', 'prod-2'])
            ->willReturn(['prod-1' => true, 'prod-2' => true]);

        $this->service->validateCreate($payload);
        $this->assertTrue(true);
    }

    public function testValidateCreateThrowsExceptionForMissingEmail(): void
    {
        $payload = [
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
        ];

        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Customer email is required');

        $this->service->validateCreate($payload);
    }

    public function testValidateCreateThrowsExceptionForEmptyEmail(): void
    {
        $payload = [
            'customer_email' => '',
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
        ];

        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Customer email is required');

        $this->service->validateCreate($payload);
    }

    public function testValidateCreateThrowsExceptionForInvalidEmail(): void
    {
        $payload = [
            'customer_email' => 'invalid-email',
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
        ];

        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Invalid email format');

        $this->service->validateCreate($payload);
    }

    public function testValidateCreateThrowsExceptionForMissingFirstName(): void
    {
        $payload = [
            'customer_email' => 'test@example.com',
            'customer_last_name' => 'Doe',
        ];

        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Customer first_name is required');

        $this->service->validateCreate($payload);
    }

    public function testValidateCreateThrowsExceptionForMissingLastName(): void
    {
        $payload = [
            'customer_email' => 'test@example.com',
            'customer_first_name' => 'John',
        ];

        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Customer last_name is required');

        $this->service->validateCreate($payload);
    }

    public function testValidateCreateWithoutItems(): void
    {
        $payload = [
            'customer_email' => 'test@example.com',
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
        ];

        $this->menuServiceClient
            ->expects($this->never())
            ->method('areItemsAvailable');

        $this->service->validateCreate($payload);
        $this->assertTrue(true);
    }

    public function testValidateItemsWithValidItems(): void
    {
        $items = [
            ['product_id' => 'prod-1'],
            ['product_id' => 'prod-2'],
        ];

        $this->menuServiceClient
            ->expects($this->once())
            ->method('areItemsAvailable')
            ->with(['prod-1', 'prod-2'])
            ->willReturn(['prod-1' => true, 'prod-2' => true]);

        $this->service->validateItems($items);
        $this->assertTrue(true);
    }

    public function testValidateItemsThrowsExceptionForUnavailableItem(): void
    {
        $items = [
            ['product_id' => 'prod-1'],
            ['product_id' => 'prod-2'],
        ];

        $this->menuServiceClient
            ->expects($this->once())
            ->method('areItemsAvailable')
            ->with(['prod-1', 'prod-2'])
            ->willReturn(['prod-1' => true, 'prod-2' => false]);

        try {
            $this->service->validateItems($items);
            $this->fail('Expected OrderValidationException was not thrown');
        } catch (OrderValidationException $e) {
            $errors = $e->errors();
            $this->assertArrayHasKey('unavailable_items', $errors);
            $this->assertContains('prod-2', $errors['unavailable_items']);
            $this->assertStringContainsString('prod-2', $errors['message']);
        }
    }

    public function testValidateItemsThrowsExceptionForMultipleUnavailableItems(): void
    {
        $items = [
            ['product_id' => 'prod-1'],
            ['product_id' => 'prod-2'],
            ['product_id' => 'prod-3'],
        ];

        $this->menuServiceClient
            ->expects($this->once())
            ->method('areItemsAvailable')
            ->with(['prod-1', 'prod-2', 'prod-3'])
            ->willReturn(['prod-1' => false, 'prod-2' => true, 'prod-3' => false]);

        $this->expectException(OrderValidationException::class);

        $this->service->validateItems($items);
    }

    public function testValidateItemsThrowsExceptionForMissingProductId(): void
    {
        $items = [
            ['quantity' => 1],
        ];

        try {
            $this->service->validateItems($items);
            $this->fail('Expected OrderValidationException was not thrown');
        } catch (OrderValidationException $e) {
            $errors = $e->errors();
            $this->assertArrayHasKey('product_id', $errors);
            $this->assertStringContainsString('Product ID is required', $errors['product_id']);
        }
    }

    public function testValidateItemsThrowsExceptionForEmptyProductId(): void
    {
        $items = [
            ['product_id' => ''],
        ];

        try {
            $this->service->validateItems($items);
            $this->fail('Expected OrderValidationException was not thrown');
        } catch (OrderValidationException $e) {
            $errors = $e->errors();
            $this->assertArrayHasKey('product_id', $errors);
            $this->assertStringContainsString('Product ID is required', $errors['product_id']);
        }
    }

    public function testValidateItemsWithEmptyArray(): void
    {
        $this->menuServiceClient
            ->expects($this->never())
            ->method('areItemsAvailable');

        $this->service->validateItems([]);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromDraftToSubmitted(): void
    {
        $this->service->validateStatusTransition(OrderStatus::DRAFT, OrderStatus::SUBMITTED);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromSubmittedToConfirmed(): void
    {
        $this->service->validateStatusTransition(OrderStatus::SUBMITTED, OrderStatus::CONFIRMED);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromConfirmedToProcessing(): void
    {
        $this->service->validateStatusTransition(OrderStatus::CONFIRMED, OrderStatus::PROCESSING);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromProcessingToShipped(): void
    {
        $this->service->validateStatusTransition(OrderStatus::PROCESSING, OrderStatus::SHIPPED);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromShippedToDelivered(): void
    {
        $this->service->validateStatusTransition(OrderStatus::SHIPPED, OrderStatus::DELIVERED);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromDraftToCancelled(): void
    {
        $this->service->validateStatusTransition(OrderStatus::DRAFT, OrderStatus::CANCELLED);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionFromShippedToRefunded(): void
    {
        $this->service->validateStatusTransition(OrderStatus::SHIPPED, OrderStatus::REFUNDED);
        $this->assertTrue(true);
    }

    public function testValidateStatusTransitionThrowsExceptionForInvalidTransition(): void
    {
        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Cannot transition from draft to delivered');

        $this->service->validateStatusTransition(OrderStatus::DRAFT, OrderStatus::DELIVERED);
    }

    public function testValidateStatusTransitionThrowsExceptionForInvalidCurrentStatus(): void
    {
        $this->expectException(OrderValidationException::class);

        $this->service->validateStatusTransition('invalid', OrderStatus::SUBMITTED);
    }

    public function testValidateStatusTransitionThrowsExceptionForInvalidNewStatus(): void
    {
        $this->expectException(OrderValidationException::class);

        $this->service->validateStatusTransition(OrderStatus::DRAFT, 'invalid');
    }

    public function testValidateStatusTransitionThrowsExceptionFromCancelledStatus(): void
    {
        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Cannot transition from cancelled to submitted');

        $this->service->validateStatusTransition(OrderStatus::CANCELLED, OrderStatus::SUBMITTED);
    }

    public function testValidateStatusTransitionThrowsExceptionFromRefundedStatus(): void
    {
        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Cannot transition from refunded to submitted');

        $this->service->validateStatusTransition(OrderStatus::REFUNDED, OrderStatus::SUBMITTED);
    }
}
