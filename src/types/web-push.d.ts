// Khai báo type tối thiểu cho web-push (không cài @types để không thêm thư viện)
declare module 'web-push' {
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: unknown,
    payload?: string,
    options?: Record<string, unknown>
  ): Promise<{ statusCode: number }>;
  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };
  export default webpush;
}
