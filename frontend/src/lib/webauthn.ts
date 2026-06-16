export type PublicKeyCredentialDescriptorInput = {
  id: string;
  transports?: AuthenticatorTransport[];
  type?: PublicKeyCredentialType;
};

export type PublicKeyCreationOptionsInput = {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string } & Record<string, unknown>;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  excludeCredentials?: PublicKeyCredentialDescriptorInput[];
} & Record<string, unknown>;

export type PublicKeyRequestOptionsInput = {
  challenge: string;
  allowCredentials?: PublicKeyCredentialDescriptorInput[];
} & Record<string, unknown>;

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4 || 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function mapCredentialDescriptor(credential: PublicKeyCredentialDescriptorInput): PublicKeyCredentialDescriptor {
  return {
    ...credential,
    type: credential.type || 'public-key',
    id: base64UrlToBuffer(credential.id),
  };
}

export function toPublicKeyCreationOptions(options: PublicKeyCreationOptionsInput): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map(mapCredentialDescriptor),
  };
}

export function toPublicKeyRequestOptions(options: PublicKeyRequestOptionsInput): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map(mapCredentialDescriptor),
  };
}

export function serializeRegistrationCredential(credential: PublicKeyCredential) {
  const attestationResponse = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(attestationResponse.clientDataJSON),
      attestationObject: bufferToBase64Url(attestationResponse.attestationObject),
      transports: typeof attestationResponse.getTransports === 'function' ? attestationResponse.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}

export function serializeAuthenticationCredential(credential: PublicKeyCredential) {
  const assertionResponse = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(assertionResponse.clientDataJSON),
      authenticatorData: bufferToBase64Url(assertionResponse.authenticatorData),
      signature: bufferToBase64Url(assertionResponse.signature),
      userHandle: assertionResponse.userHandle ? bufferToBase64Url(assertionResponse.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}
