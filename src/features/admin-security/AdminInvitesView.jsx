import AdminInvitesPanel from "../../components/AdminInvitesPanel.jsx";
import { useInvites } from "../../hooks/useInvites";
import { sendWelcomeEmail } from "../../utils/email.js";
import { notifyTelegram } from "../../utils/telegram.js";

export default function AdminInvitesView({ showToast }) {
  const { invites, addInvite, approveInvite, resetInvites } = useInvites();

  const onApproveInvite = (id, email, name) => {
    approveInvite(id);
    sendWelcomeEmail(email, name);
    showToast("Welcome email sent", "success");

    if (typeof notifyTelegram === "function") {
      notifyTelegram("invite_approved", { id, email, name });
    }
  };

  const onAddDemoInvite = () => {
    const invite = addInvite("demo recruit@example.com", "Demo Recruit");

    if (typeof notifyTelegram === "function") {
      notifyTelegram("invite_requested", {
        id: invite?.id,
        email: invite?.email,
        name: invite?.name,
      });
    }
  };

  return (
    <AdminInvitesPanel
      invites={invites}
      onApproveInvite={onApproveInvite}
      onAddDemoInvite={onAddDemoInvite}
      onResetInvites={resetInvites}
      showToast={showToast}
    />
  );
}
