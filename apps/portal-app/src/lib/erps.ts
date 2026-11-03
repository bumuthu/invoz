export const erpCatalog = [
  { code: "s4hana", name: "S/4HANA" },
  { code: "sap_ecc", name: "SAP ECC" },
  { code: "sap_b1", name: "SAP B1" },
  { code: "ifs", name: "IFS" },
  { code: "dynamics", name: "Dynamics" },
  { code: "business_central", name: "Business Central" },
  { code: "oracle", name: "Oracle" },
  { code: "netsuite", name: "NetSuite" },
  { code: "odoo", name: "Odoo" },
  { code: "nav", name: "NAV" },
] as const;

export type ErpCode = (typeof erpCatalog)[number]["code"];

export function isErpCode(value: string): value is ErpCode {
  return erpCatalog.some((erp) => erp.code === value);
}

export function erpName(code: string): string {
  return erpCatalog.find((erp) => erp.code === code)?.name ?? code;
}
