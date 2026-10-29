import { type FormEvent, useState } from "react";

import { errorMessage } from "@/api/errors";
import { useReport, useReportReasons } from "@/api/queries/social";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Alert, Field, Select, Textarea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  contentType: string;
  objectId: string;
}

/** Report content to moderators. Reporters are never revealed to the person reported. */
export function ReportDialog({ open, onClose, contentType, objectId }: ReportDialogProps) {
  const reasons = useReportReasons(open);
  const report = useReport();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    report.mutate(
      { content_type: contentType, object_id: objectId, reason, details },
      {
        onSuccess: () => {
          toast.success("Thanks for letting us know. Our moderators will take a look.");
          setReason("");
          setDetails("");
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Report this">
      <form className="stack" onSubmit={onSubmit}>
        <p className="muted">Your report is confidential. The person you report won't find out it was you.</p>
        {report.isError && <Alert tone="error">{errorMessage(report.error)}</Alert>}
        <Field label="What's wrong?">
          <Select required value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="" disabled>
              {reasons.isPending ? "Loading reasons…" : "Choose a reason"}
            </option>
            {reasons.data?.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Anything else we should know?" optional>
          <Textarea maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} />
        </Field>
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={report.isPending} disabled={!reason}>
            Send report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
