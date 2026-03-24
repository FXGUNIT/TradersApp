import React from 'react';

const EmptyStateCard = ({ searchQuery, filterStatus }) => {
  const getEmptyMessage = () => {
    if (searchQuery) {
      return {
        icon: '🔍',
        title: 'NO TRADERS FOUND MATCHING THAT SEARCH',
        subtitle: `No traders match "${searchQuery}". Try adjusting your search terms or clearing filters.`
      };
    } else if (filterStatus === 'PENDING') {
      return {
        icon: '📋',
        title: 'NO PENDING APPLICATIONS FOUND',
        subtitle: 'All applications have been processed. Come back later for new registrations.'
      };
    } else if (filterStatus === 'ACTIVE') {
      return {
        icon: '✓',
        title: 'NO ACTIVE TRADERS FOUND',
        subtitle: 'No traders are currently active. Approve pending applications to activate them.'
      };
    } else if (filterStatus === 'BLOCKED') {
      return {
        icon: '🚫',
        title: 'NO BANNED USERS FOUND',
        subtitle: 'No users have been banned from the platform.'
      };
    } else {
      return {
        icon: '👥',
        title: 'NO USERS REGISTERED YET',
        subtitle: 'No traders have signed up yet. Share your invitation link to get started.'
      };
    }
  };
  
  const msg = getEmptyMessage();
  
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
        fontSize: 48,
        marginBottom: 20,
        opacity: 0.6,
        animation: "float 3s ease-in-out infinite"
      }}>
        {msg.icon}
      </div>
      
      <div style={{
        color: "#8E8E93",
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 12,
        maxWidth: 400
      }}>
        {msg.title}
      </div>
      
      <div style={{
        color: "#3A3A3C",
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
