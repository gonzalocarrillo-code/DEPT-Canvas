import {
  DOMParser,
  XMLSerializer,
  type Document as XmldomDocument,
  type Element as XmldomElement,
} from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import type { EdgeRole } from "../validate-token.js";
import { TokenValidationError } from "../validate-token.js";
import { assertAssertionNotReplayed } from "./saml-replay-cache.js";

const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
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

function spAudience(): string {
  const audience = process.env.SAML_SP_AUDIENCE ?? process.env.SAML_SP_ENTITY_ID;
  if (!audience) {
    throw new TokenValidationError("SAML_SP_AUDIENCE is not configured");
  }
  return audience;
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

function validateStatus(doc: XmldomDocument): void {
  const statusCode = doc.getElementsByTagNameNS(
    SAML_PROTOCOL_NS,
    "StatusCode",
  ).item(0);
  const value = statusCode?.getAttribute("Value") ?? "";
  if (!value.endsWith(":Success")) {
    throw new TokenValidationError("SAML response status is not Success");
  }
}

function referencedAssertionId(signatureNode: XmldomElement): string {
  const references = signatureNode.getElementsByTagNameNS(
    XMLDSIG_NS,
    "Reference",
  );
  for (let i = 0; i < references.length; i += 1) {
    const ref = references.item(i);
    if (!ref) continue;
    const uri = ref.getAttribute("URI");
    if (uri?.startsWith("#")) {
      return uri.slice(1);
    }
  }
  throw new TokenValidationError("SAML signature reference binding missing");
}

function findElementById(root: XmldomDocument, id: string): XmldomElement | null {
  const nodes = root.getElementsByTagNameNS(SAML_ASSERTION_NS, "Assertion");
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes.item(i);
    if (node?.getAttribute("ID") === id) {
      return node;
    }
  }
  return null;
}

function validateConditions(assertion: XmldomElement): void {
  const conditions = assertion.getElementsByTagNameNS(
    SAML_ASSERTION_NS,
    "Conditions",
  ).item(0);
  if (!conditions) {
    throw new TokenValidationError("SAML Conditions missing");
  }

  const audienceNodes = conditions.getElementsByTagNameNS(
    SAML_ASSERTION_NS,
    "Audience",
  );
  const expectedAudience = spAudience();
  let audienceMatch = false;
  for (let i = 0; i < audienceNodes.length; i += 1) {
    if (audienceNodes.item(i)?.textContent?.trim() === expectedAudience) {
      audienceMatch = true;
      break;
    }
  }
  if (!audienceMatch) {
    throw new TokenValidationError("SAML audience mismatch");
  }

  const notBefore = conditions.getAttribute("NotBefore");
  const notOnOrAfter = conditions.getAttribute("NotOnOrAfter");
  const now = Date.now();
  if (notBefore) {
    const notBeforeMs = Date.parse(notBefore);
    if (!Number.isNaN(notBeforeMs) && now < notBeforeMs) {
      throw new TokenValidationError("SAML assertion not yet valid");
    }
  }
  if (notOnOrAfter) {
    const notOnOrAfterMs = Date.parse(notOnOrAfter);
    if (!Number.isNaN(notOnOrAfterMs) && now >= notOnOrAfterMs) {
      throw new TokenValidationError("SAML assertion expired");
    }
  }
}

function verifySignedAssertion(assertionNode: XmldomElement): void {
  const assertionXml = new XMLSerializer().serializeToString(assertionNode);
  const signatureNodes = assertionNode.getElementsByTagNameNS(
    XMLDSIG_NS,
    "Signature",
  );
  if (signatureNodes.length === 0) {
    throw new TokenValidationError("SAML assertion is not signed");
  }

  const referencedId = referencedAssertionId(signatureNodes.item(0)!);
  const assertionId = assertionNode.getAttribute("ID");
  if (!assertionId || assertionId !== referencedId) {
    throw new TokenValidationError("SAML signature reference binding mismatch");
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
  validateStatus(doc);

  const assertionNodes = doc.getElementsByTagNameNS(SAML_ASSERTION_NS, "Assertion");
  if (assertionNodes.length === 0) {
    throw new TokenValidationError("SAML assertion missing");
  }

  let signedAssertion: XmldomElement | undefined;
  for (let i = 0; i < assertionNodes.length; i += 1) {
    const candidate = assertionNodes.item(i);
    if (!candidate) continue;
    const signatures = candidate.getElementsByTagNameNS(XMLDSIG_NS, "Signature");
    if (signatures.length === 0) {
      continue;
    }
    const referencedId = referencedAssertionId(signatures.item(0)!);
    const bound = findElementById(doc, referencedId);
    if (!bound || bound !== candidate) {
      throw new TokenValidationError("SAML signature wrapping detected");
    }
    signedAssertion = candidate;
    break;
  }

  if (!signedAssertion) {
    throw new TokenValidationError("SAML assertion is not signed");
  }

  verifySignedAssertion(signedAssertion);
  validateConditions(signedAssertion);

  const assertionId = signedAssertion.getAttribute("ID");
  if (!assertionId) {
    throw new TokenValidationError("SAML assertion ID missing");
  }
  try {
    assertAssertionNotReplayed(assertionId);
  } catch {
    throw new TokenValidationError("SAML assertion replay detected");
  }

  const nameIdNode = signedAssertion.getElementsByTagNameNS(
    SAML_ASSERTION_NS,
    "NameID",
  ).item(0);
  const userId = nameIdNode?.textContent?.trim();
  if (!userId) {
    throw new TokenValidationError("SAML NameID missing");
  }

  const attrs = parseAttributes(signedAssertion);
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
