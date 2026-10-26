export type CommitFailure = {
  organizationId: number;
  legalEntityId: number;
  branchId: number;
  erpReference: string;
  serialNumber: string;
  clearanceToken: string;
  clearedAt: string;
  error: unknown;
};

export function alertRamisClearedCommitFailed(failure: CommitFailure): void {
  const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
  const record = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: "Invoz/InvoiceEngine",
          Dimensions: [["Function"]],
          Metrics: [{ Name: "RamisClearedCommitFailed", Unit: "Count" }],
        },
      ],
    },
    Function: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "invoice-engine",
    RamisClearedCommitFailed: 1,
    level: "CRITICAL",
    event: "ramis_cleared_commit_failed",
    message: "RAMIS cleared the invoice but the database commit failed",
    organizationId: failure.organizationId,
    legalEntityId: failure.legalEntityId,
    branchId: failure.branchId,
    erpReference: failure.erpReference,
    serialNumber: failure.serialNumber,
    clearanceToken: failure.clearanceToken,
    clearedAt: failure.clearedAt,
    error: message,
  };
  console.error(JSON.stringify(record));
}
