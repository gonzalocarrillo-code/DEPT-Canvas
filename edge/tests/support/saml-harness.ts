import { SignedXml } from "xml-crypto";
import type { EdgeRole } from "../../src/validate-token.js";

const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";

export interface SignedSamlOptions {
  userId: string;
  tenantId: string;
  role: EdgeRole;
  privateKeyPem: string;
  certificatePem: string;
  audience?: string;
  notOnOrAfter?: string;
  notBefore?: string;
  assertionId?: string;
}

function conditionsBlock(options: SignedSamlOptions): string {
  const audience = options.audience ?? "dept-canvas-sp";
  const notBefore =
    options.notBefore ?? new Date(Date.now() - 60_000).toISOString();
  const notOnOrAfter =
    options.notOnOrAfter ?? new Date(Date.now() + 300_000).toISOString();
  return `<saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}"><saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions>`;
}

function buildAssertion(options: SignedSamlOptions): {
  assertionId: string;
  assertion: string;
} {
  const assertionId = options.assertionId ?? `_assertion_${Date.now()}`;
  const issueInstant = new Date().toISOString();
  const assertion = `<saml:Assertion xmlns:saml="${SAML_ASSERTION_NS}" ID="${assertionId}" IssueInstant="${issueInstant}" Version="2.0"><saml:Issuer>test-idp</saml:Issuer>${conditionsBlock(options)}<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${options.userId}</saml:NameID></saml:Subject><saml:AttributeStatement><saml:Attribute Name="tenant_id"><saml:AttributeValue>${options.tenantId}</saml:AttributeValue></saml:Attribute><saml:Attribute Name="role"><saml:AttributeValue>${options.role}</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>`;
  return { assertionId, assertion };
}

function signAssertion(
  assertion: string,
  privateKeyPem: string,
  certificatePem: string,
): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
  });
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.computeSignature(assertion, {
    location: { reference: "//*[local-name(.)='Assertion']", action: "append" },
  });
  return sig.getSignedXml();
}

export function createSignedTestSamlResponse(options: SignedSamlOptions): string {
  const { assertion } = buildAssertion(options);
  const signedAssertion = signAssertion(
    assertion,
    options.privateKeyPem,
    options.certificatePem,
  );
  const responseId = `_response_${Date.now()}`;
  const issueInstant = new Date().toISOString();
  const response = `<samlp:Response xmlns:samlp="${SAML_PROTOCOL_NS}" ID="${responseId}" Version="2.0" IssueInstant="${issueInstant}"><saml:Issuer xmlns:saml="${SAML_ASSERTION_NS}">test-idp</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>${signedAssertion}</samlp:Response>`;
  return Buffer.from(response, "utf8").toString("base64");
}

/** Inserts an unsigned malicious assertion ahead of the signed one (XSW probe). */
export function createWrappedSamlAttackResponse(
  options: SignedSamlOptions,
): string {
  const signed = createSignedTestSamlResponse(options);
  const xml = Buffer.from(signed, "base64").toString("utf8");
  const evilAssertion = `<saml:Assertion xmlns:saml="${SAML_ASSERTION_NS}" ID="_evil"><saml:Subject><saml:NameID>attacker@test</saml:NameID></saml:Subject><saml:AttributeStatement><saml:Attribute Name="tenant_id"><saml:AttributeValue>tenant-b</saml:AttributeValue></saml:Attribute><saml:Attribute Name="role"><saml:AttributeValue>tenant_admin</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>`;
  const injected = xml.replace(
    "<samlp:Status>",
    `<samlp:Status>${evilAssertion}`,
  );
  return Buffer.from(injected, "utf8").toString("base64");
}

export function createStaleSamlResponse(options: SignedSamlOptions): string {
  return createSignedTestSamlResponse({
    ...options,
    notOnOrAfter: new Date(Date.now() - 60_000).toISOString(),
  });
}

export function createWrongAudienceSamlResponse(
  options: SignedSamlOptions,
): string {
  return createSignedTestSamlResponse({
    ...options,
    audience: "wrong-audience",
  });
}
