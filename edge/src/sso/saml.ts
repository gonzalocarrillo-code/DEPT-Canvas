import {
  DOMParser,
  XMLSerializer,
  type Document as XmldomDocument,
  type Element as XmldomElement,
} from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import type { EdgeRole } from "../validate-token.js";
import { TokenValidationError } from "../validate-token.js";

const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#";

export interface SamlProfile {
  userId: string;
  tenantId: string;
  role: EdgeRole;
}

function idpCertPem(): string {
  const cert = process.env.SAML_IDP_CERT;
  if (!cert) {
    throw new TokenValidationError("SAML_IDP_CERT is not configured");
  }
  return cert.includes("BEGIN CERTIFICATE")
    ? cert
    : `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
}

function parseAttributes(assertion: XmldomElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  const nodes = assertion.getElementsByTagNameNS(SAML_ASSERTION_NS, "Attribute");
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes.item(i);
    if (!node) continue;
    const name = node.getAttribute("Name");
    const valueNode = node.getElementsByTagNameNS(
      SAML_ASSERTION_NS,
      "AttributeValue",
    ).item(0);
    const value = valueNode?.textContent?.trim();
    if (name && value) {
      attrs[name] = value;
    }
  }
  return attrs;
}

function isValidRole(value: string): value is EdgeRole {
  return [
    "viewer",
    "creator",
    "brand_owner",
    "approver",
    "tenant_admin",
  ].includes(value);
}

export function verifySamlResponse(samlResponseB64: string): SamlProfile {
  if (!samlResponseB64 || samlResponseB64.trim().length === 0) {
    throw new TokenValidationError("SAMLResponse is required");
  }

  let xml: string;
  try {
    xml = Buffer.from(samlResponseB64, "base64").toString("utf8");
  } catch {
    throw new TokenValidationError("SAMLResponse is not valid base64");
  }

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const assertionNodes = doc.getElementsByTagNameNS(SAML_ASSERTION_NS, "Assertion");
  if (assertionNodes.length === 0) {
    throw new TokenValidationError("SAML assertion missing");
  }
  const assertionNode = assertionNodes.item(0)!;
  const assertionXml = new XMLSerializer().serializeToString(assertionNode);

  const signatureNodes = assertionNode.getElementsByTagNameNS(
    XMLDSIG_NS,
    "Signature",
  );
  if (signatureNodes.length === 0) {
    throw new TokenValidationError("SAML assertion is not signed");
  }

  const certPem = idpCertPem();
  const signedXml = new SignedXml({ publicCert: certPem });
  signedXml.loadSignature(signatureNodes.item(0)! as unknown as Node);
  let valid = false;
  try {
    valid = signedXml.checkSignature(assertionXml);
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new TokenValidationError("SAML signature verification failed");
  }

  const nameIdNode = assertionNode.getElementsByTagNameNS(
    SAML_ASSERTION_NS,
    "NameID",
  ).item(0);
  const userId = nameIdNode?.textContent?.trim();
  if (!userId) {
    throw new TokenValidationError("SAML NameID missing");
  }

  const attrs = parseAttributes(assertionNode);
  const tenantId = attrs.tenant_id ?? attrs["http://schemas.dept.canvas/tenant_id"];
  const roleRaw = attrs.role ?? attrs["http://schemas.dept.canvas/role"];
  if (!tenantId) {
    throw new TokenValidationError("SAML tenant_id attribute missing");
  }
  if (!roleRaw || !isValidRole(roleRaw)) {
    throw new TokenValidationError("SAML role attribute invalid");
  }

  return { userId, tenantId, role: roleRaw };
}

export function createSignedTestSamlResponse(options: {
  userId: string;
  tenantId: string;
  role: EdgeRole;
  privateKeyPem: string;
  certificatePem: string;
}): string {
  const assertionId = `_assertion_${Date.now()}`;
  const responseId = `_response_${Date.now()}`;
  const issueInstant = new Date().toISOString();

  const assertion = `<saml:Assertion xmlns:saml="${SAML_ASSERTION_NS}" ID="${assertionId}" IssueInstant="${issueInstant}" Version="2.0"><saml:Issuer>test-idp</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${options.userId}</saml:NameID></saml:Subject><saml:AttributeStatement><saml:Attribute Name="tenant_id"><saml:AttributeValue>${options.tenantId}</saml:AttributeValue></saml:Attribute><saml:Attribute Name="role"><saml:AttributeValue>${options.role}</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>`;

  const sig = new SignedXml({
    privateKey: options.privateKeyPem,
    publicCert: options.certificatePem,
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

  const signedAssertion = sig.getSignedXml();
  const response = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${responseId}" Version="2.0" IssueInstant="${issueInstant}"><saml:Issuer xmlns:saml="${SAML_ASSERTION_NS}">test-idp</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>${signedAssertion}</samlp:Response>`;

  return Buffer.from(response, "utf8").toString("base64");
}
