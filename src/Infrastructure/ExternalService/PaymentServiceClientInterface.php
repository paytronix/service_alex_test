<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

interface PaymentServiceClientInterface
{
    public function initiatePayment(string $orderId, string $amount, string $currency): string;

    public function cancelPayment(string $orderId): void;

    public function refundPayment(string $orderId, string $amount, string $currency): string;

    public function getPaymentStatus(string $orderId): ?string;
}
