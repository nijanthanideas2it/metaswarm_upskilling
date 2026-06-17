export interface IUserInvitationService {
  /**
   * Sends a set-password invitation email to a newly created customer.
   * Implemented by generating a password reset token via the Auth module's
   * PasswordResetRepository and dispatching an email through the email service.
   */
  sendInvitation(userId: string, email: string): Promise<void>;
}
