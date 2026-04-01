import React from 'react';
import { Search, ClipboardList, CheckCircle2, Ban, Users } from 'lucide-react';
import { CSS_VARS } from "../styles/cssVars.js";

const EmptyStateCard = ({ searchQuery, filterStatus }) => {
  const getEmptyMessage = () => {
    if (searchQuery) {
      return {
        Icon: Search,
        title: 'NO TRADERS FOUND MATCHING THAT SEARCH',
        subtitle: `No traders match "${searchQuery}". Try adjusting your search terms or clearing filters.`
      };
    } else if (filterStatus === 'PENDING') {
      return {
        Icon: ClipboardList,
        title: 'NO PENDING APPLICATIONS FOUND',
        subtitle: 'All applications have been processed. Come back later for new registrations.'
      };
    } else if (filterStatus === 'ACTIVE') {
      return {
        Icon: CheckCircle2,
        title: 'NO ACTIVE TRADERS FOUND',
        subtitle: 'No traders are currently active. Approve pending applications to activate them.'
      };
    } else if (filterStatus === 'BLOCKED') {
      return {
        Icon: Ban,
        title: 'NO BANNED USERS FOUND',
        subtitle: 'No users have been banned from the platform.'
      };
    } else {
      return {
        Icon: Users,
        title: 'NO USERS REGISTERED YET',
        subtitle: 'No traders have signed up yet. Share your invitation link to get started.'
      };
    }
  };

  const msg = getEmptyMessage();
  const IconComp = msg.Icon;

  return (
    <div style={{
      padding: "80px 40px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "400px",
      background: "rgba(255,255,255,0.01)"
    }}>
      <div style={{
        marginBottom: 20,
        opacity: 0.6,
        animation: "float 3s ease-in-out infinite",
        color: CSS_VARS.textTertiary
      }}>
        <IconComp size={48} />
      </div>

      <div style={{
        color: CSS_VARS.textSecondary,
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 12,
        maxWidth: 400
      }}>
        {msg.title}
      </div>

      <div style={{
        color: CSS_VARS.textTertiary,
        fontSize: 12,
        marginBottom: 24,
        maxWidth: 400,
        lineHeight: 1.6
      }}>
        {msg.subtitle}
      </div>
    </div>
  );
};

export default EmptyStateCard;
