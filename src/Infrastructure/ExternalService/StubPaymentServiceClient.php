<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

use Psr\Log\LoggerInterface;

final class StubPaymentServiceClient implements PaymentServiceClientInterface
{
    private LoggerInterface $logger;
    private array $payments = [];
    private bool $shouldFail = false;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    public function initiatePayment(string $orderId, string $amount, string $currency): string
    {
        $this->logger->info('StubPaymentServiceClient: initiatePayment', [
            'order_id' => $orderId,
            'amount' => $amount,
            'currency' => $currency,
        ]);

        if ($this->shouldFail) {
            throw new \RuntimeException('Payment service unavailable');
        }

        $paymentId = 'PAY-' . uniqid();
        $this->payments[$orderId] = [
            'payment_id' => $paymentId,
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'initiated',
            'initiated_at' => (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
        ];

        return $paymentId;
    }

    public function cancelPayment(string $orderId): void
    {
        $this->logger->info('StubPaymentServiceClient: cancelPayment', [
            'order_id' => $orderId,
        ]);

        if ($this->shouldFail) {
            throw new \RuntimeException('Payment service unavailable');
        }

        if (isset($this->payments[$orderId])) {
            $this->payments[$orderId]['status'] = 'cancelled';
            $this->payments[$orderId]['cancelled_at'] = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        }
    }

    public function refundPayment(string $orderId, string $amount, string $currency): string
    {
        $this->logger->info('StubPaymentServiceClient: refundPayment', [
            'order_id' => $orderId,
            'amount' => $amount,
            'currency' => $currency,
        ]);

        if ($this->shouldFail) {
            throw new \RuntimeException('Payment service unavailable');
        }

        $refundId = 'REF-' . uniqid();
        if (isset($this->payments[$orderId])) {
            $this->payments[$orderId]['status'] = 'refunded';
            $this->payments[$orderId]['refund_id'] = $refundId;
            $this->payments[$orderId]['refund_amount'] = $amount;
            $this->payments[$orderId]['refunded_at'] = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        }

        return $refundId;
    }

    public function getPaymentStatus(string $orderId): ?string
    {
        $this->logger->info('StubPaymentServiceClient: getPaymentStatus', [
            'order_id' => $orderId,
        ]);

        return $this->payments[$orderId]['status'] ?? null;
    }

    public function getPayments(): array
    {
        return $this->payments;
    }

    public function setShouldFail(bool $shouldFail): void
    {
        $this->shouldFail = $shouldFail;
    }

    public function reset(): void
    {
        $this->payments = [];
        $this->shouldFail = false;
    }
}
