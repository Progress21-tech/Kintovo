import { notificationCategories, channelEnabled, type NotificationCategory, type PreferenceRow } from "@/server/notifications";
import { saveNotificationPreferences } from "./actions";

export function NotificationPreferences({ preferences, saved, emailConfigured }: { preferences: PreferenceRow[]; saved: boolean; emailConfigured: boolean }) {
  return <section className="panel" id="notification-preferences" style={{ marginTop: 16 }}>
    <div className="panel-header"><div><h2>Notification preferences</h2><span className="field-note">Account, dispute, and payment updates always stay in your in-app inbox. Email is off until you turn it on.</span></div></div>
    <div className="panel-content">
      {saved && <p className="form-success" role="status">Notification preferences saved.</p>}
      {!emailConfigured && <p className="notice">Email delivery is not configured on this deployment, so email choices are saved but not sent yet.</p>}
      <form action={saveNotificationPreferences} className="form-stack">
        <div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Update type</th><th scope="col">In-app</th><th scope="col">Email</th></tr></thead><tbody>
          {(Object.keys(notificationCategories) as NotificationCategory[]).map((category) => {
            const meta = notificationCategories[category];
            return <tr key={category}><th scope="row">{meta.label}</th>
              <td><input type="checkbox" aria-label={`In-app: ${meta.label}`} name={`inApp:${category}`} defaultChecked={channelEnabled(preferences, category, "inApp")} disabled={meta.required} />{meta.required && <small className="field-note"> Required</small>}</td>
              <td><input type="checkbox" aria-label={`Email: ${meta.label}`} name={`email:${category}`} defaultChecked={channelEnabled(preferences, category, "email")} /></td></tr>;
          })}
        </tbody></table></div>
        <button className="button button-primary button-small">Save preferences</button>
      </form>
    </div>
  </section>;
}
