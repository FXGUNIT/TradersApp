import React from 'react';

const SkeletonLoader = ({ width = "100%", height = "20px", borderRadius = "8px", count = 1 }) => {
  const skeletonStyle = {
    width,
    height,
    borderRadius,
    background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 2s infinite",
    marginBottom: count > 1 ? "12px" : "0px"
  };

  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={skeletonStyle} />
      ))}
    </div>
  );
};

export default SkeletonLoader;
