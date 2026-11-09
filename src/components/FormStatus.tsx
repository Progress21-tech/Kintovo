export function FormStatus({ error, success }: { error?: string; success?: string }) {
  return <>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
  </>;
}
