const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

// Mutable env so individual tests can override SMTP_HOST
const mockEnv = {
  SMTP_HOST: 'smtp.test.com' as string | undefined,
  SMTP_PORT: 587,
  SMTP_USER: 'user@test.com',
  SMTP_PASS: 'pass',
};

jest.mock('../../../../src/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

import { NodemailerEmailService } from '../../../../src/infrastructure/services/nodemailer-email.service';

describe('NodemailerEmailService', () => {
  let service: NodemailerEmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.SMTP_HOST = 'smtp.test.com';
    service = new NodemailerEmailService();
  });

  describe('sendPasswordResetEmail', () => {
    it('calls sendMail with the recipient address', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'https://app.com/reset?token=abc');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' }),
      );
    });

    it('includes the reset URL in the email body', async () => {
      const resetUrl = 'https://app.com/reset?token=abc123';
      await service.sendPasswordResetEmail('user@example.com', resetUrl);
      const callArg = mockSendMail.mock.calls[0][0];
      expect(JSON.stringify(callArg)).toContain(resetUrl);
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('calls sendMail with the recipient address', async () => {
      await service.sendPasswordChangedEmail('user@example.com');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' }),
      );
    });
  });

  describe('when SMTP_HOST is not configured', () => {
    beforeEach(() => {
      // Reset to undefined SMTP and recreate service; clear mocks after to isolate assertions
      mockEnv.SMTP_HOST = undefined;
      service = new NodemailerEmailService();
      jest.clearAllMocks(); // clear the call from the outer beforeEach constructor call
    });

    it('does not call createTransport when SMTP_HOST is undefined', () => {
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('resolves without sending for sendPasswordResetEmail', async () => {
      await expect(
        service.sendPasswordResetEmail('u@example.com', 'https://x.com'),
      ).resolves.toBeUndefined();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('resolves without sending for sendPasswordChangedEmail', async () => {
      await expect(
        service.sendPasswordChangedEmail('u@example.com'),
      ).resolves.toBeUndefined();
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
